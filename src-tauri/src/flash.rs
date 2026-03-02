use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write, Seek, SeekFrom};
use std::path::Path;
use tauri::{AppHandle, Emitter};
use serde::Serialize;

const BLOCK_SIZE: usize = 4 * 1024 * 1024; // 4MB

#[derive(Debug, Clone, Serialize)]
pub struct FlashProgress {
    pub bytes_written: u64,
    pub total_bytes: u64,
    pub percent: f64,
    pub stage: String,
}

/// Write raw image to block device, emitting progress events.
pub fn write_image(app: &AppHandle, image_path: &str, device: &str) -> Result<(), String> {
    let img_path = Path::new(image_path);

    // Determine if we need xz decompression
    let is_xz = image_path.ends_with(".xz");

    let total_bytes = if is_xz {
        // For .xz files, estimate decompressed size (actual size unknown until decompressed)
        // Use the compressed size * 3 as rough estimate
        let meta = fs::metadata(img_path).map_err(|e| format!("Cannot read image: {}", e))?;
        meta.len() * 3
    } else {
        let meta = fs::metadata(img_path).map_err(|e| format!("Cannot read image: {}", e))?;
        meta.len()
    };

    // Open source
    let source_file = File::open(img_path).map_err(|e| format!("Cannot open image: {}", e))?;

    let mut reader: Box<dyn Read> = if is_xz {
        Box::new(xz2::read::XzDecoder::new(source_file))
    } else {
        Box::new(source_file)
    };

    // Open target device for raw writing
    let mut target = OpenOptions::new()
        .write(true)
        .open(device)
        .map_err(|e| format!("Cannot open device {}: {}", device, e))?;

    let mut buffer = vec![0u8; BLOCK_SIZE];
    let mut bytes_written: u64 = 0;

    loop {
        let bytes_read = reader.read(&mut buffer).map_err(|e| format!("Read error: {}", e))?;
        if bytes_read == 0 {
            break;
        }

        target.write_all(&buffer[..bytes_read]).map_err(|e| format!("Write error: {}", e))?;
        bytes_written += bytes_read as u64;

        let percent = (bytes_written as f64 / total_bytes as f64 * 100.0).min(100.0);

        let _ = app.emit("flash-progress", FlashProgress {
            bytes_written,
            total_bytes,
            percent,
            stage: "writing".into(),
        });
    }

    // Sync
    target.flush().map_err(|e| format!("Flush error: {}", e))?;

    let _ = app.emit("flash-progress", FlashProgress {
        bytes_written,
        total_bytes: bytes_written,
        percent: 100.0,
        stage: "syncing".into(),
    });

    Ok(())
}

/// After writing the image, inject panel configuration into the BOOT partition (FAT32).
/// Reads the partition table to find partition 1 offset, then uses fatfs crate to
/// manipulate files directly on the block device without OS-level mounting.
pub fn post_flash_configure(
    device: &str,
    panel_dtb: &str,
    panel_id: &str,
    variant: &str,
) -> Result<(), String> {
    // Read MBR to find partition 1 offset
    let mut dev = OpenOptions::new()
        .read(true)
        .write(true)
        .open(device)
        .map_err(|e| format!("Cannot open device: {}", e))?;

    let boot_offset = read_partition1_offset(&mut dev)?;

    // Create a view of the FAT32 partition
    let partition = PartitionSlice::new(dev, boot_offset)?;
    let fs = fatfs::FileSystem::new(partition, fatfs::FsOptions::new())
        .map_err(|e| format!("Cannot open FAT32: {}", e))?;

    let root = fs.root_dir();

    // 1. Copy panel DTB as kernel.dtb
    // Read the source DTB from the partition
    let mut dtb_data = Vec::new();
    let mut src = root.open_file(panel_dtb)
        .map_err(|e| format!("Cannot read {}: {}", panel_dtb, e))?;
    src.read_to_end(&mut dtb_data)
        .map_err(|e| format!("Read DTB error: {}", e))?;
    drop(src);

    // Write as kernel.dtb
    let mut dst = root.create_file("kernel.dtb")
        .map_err(|e| format!("Cannot create kernel.dtb: {}", e))?;
    dst.truncate()
        .map_err(|e| format!("Truncate error: {}", e))?;
    dst.write_all(&dtb_data)
        .map_err(|e| format!("Write kernel.dtb error: {}", e))?;
    dst.flush()
        .map_err(|e| format!("Flush error: {}", e))?;
    drop(dst);

    // 2. Write panel.txt
    let panel_txt = format!("PanelNum={}\nPanelDTB={}\n", panel_id, panel_dtb);
    let mut f = root.create_file("panel.txt")
        .map_err(|e| format!("Cannot create panel.txt: {}", e))?;
    f.truncate().map_err(|e| format!("Truncate error: {}", e))?;
    f.write_all(panel_txt.as_bytes())
        .map_err(|e| format!("Write panel.txt error: {}", e))?;
    f.flush().map_err(|e| format!("Flush error: {}", e))?;
    drop(f);

    // 3. Write panel-confirmed
    let mut f = root.create_file("panel-confirmed")
        .map_err(|e| format!("Cannot create panel-confirmed: {}", e))?;
    f.truncate().map_err(|e| format!("Truncate error: {}", e))?;
    f.write_all(b"confirmed\n")
        .map_err(|e| format!("Write error: {}", e))?;
    f.flush().map_err(|e| format!("Flush error: {}", e))?;
    drop(f);

    // 4. Write variant
    let mut f = root.create_file("variant")
        .map_err(|e| format!("Cannot create variant: {}", e))?;
    f.truncate().map_err(|e| format!("Truncate error: {}", e))?;
    f.write_all(format!("{}\n", variant).as_bytes())
        .map_err(|e| format!("Write error: {}", e))?;
    f.flush().map_err(|e| format!("Flush error: {}", e))?;

    Ok(())
}

/// Read MBR partition table to find byte offset of partition 1.
fn read_partition1_offset(dev: &mut File) -> Result<u64, String> {
    let mut mbr = [0u8; 512];
    dev.seek(SeekFrom::Start(0))
        .map_err(|e| format!("Seek error: {}", e))?;
    dev.read_exact(&mut mbr)
        .map_err(|e| format!("Read MBR error: {}", e))?;

    // Check MBR signature
    if mbr[510] != 0x55 || mbr[511] != 0xAA {
        return Err("Invalid MBR signature".into());
    }

    // Partition 1 entry starts at offset 446
    // LBA start is at bytes 8-11 (little-endian u32)
    let lba_start = u32::from_le_bytes([mbr[454], mbr[455], mbr[456], mbr[457]]);

    if lba_start == 0 {
        return Err("Partition 1 not found in MBR".into());
    }

    Ok(lba_start as u64 * 512)
}

/// A wrapper around File that presents a partition as a seekable Read+Write+Seek.
struct PartitionSlice {
    file: File,
    offset: u64,
    pos: u64,
}

impl PartitionSlice {
    fn new(mut file: File, offset: u64) -> Result<Self, String> {
        file.seek(SeekFrom::Start(offset))
            .map_err(|e| format!("Seek to partition: {}", e))?;
        Ok(Self { file, offset, pos: 0 })
    }
}

impl Read for PartitionSlice {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let n = self.file.read(buf)?;
        self.pos += n as u64;
        Ok(n)
    }
}

impl Write for PartitionSlice {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let n = self.file.write(buf)?;
        self.pos += n as u64;
        Ok(n)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.file.flush()
    }
}

impl Seek for PartitionSlice {
    fn seek(&mut self, pos: SeekFrom) -> io::Result<u64> {
        let new_pos = match pos {
            SeekFrom::Start(p) => {
                self.file.seek(SeekFrom::Start(self.offset + p))?;
                p
            }
            SeekFrom::Current(p) => {
                let abs = self.file.seek(SeekFrom::Current(p))?;
                abs - self.offset
            }
            SeekFrom::End(p) => {
                let abs = self.file.seek(SeekFrom::End(p))?;
                abs - self.offset
            }
        };
        self.pos = new_pos;
        Ok(new_pos)
    }
}
