use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct Panel {
    pub id: String,
    pub name: String,
    pub dtb: String,
    pub is_default: bool,
}

pub fn get_panels(console: &str) -> Vec<Panel> {
    match console {
        "original" => vec![
            Panel { id: "0".into(),  name: "Panel 0".into(),          dtb: "kernel-panel0.dtb".into(), is_default: false },
            Panel { id: "1".into(),  name: "Panel 1-V10".into(),      dtb: "kernel-panel1.dtb".into(), is_default: false },
            Panel { id: "2".into(),  name: "Panel 2-V12".into(),      dtb: "kernel-panel2.dtb".into(), is_default: false },
            Panel { id: "3".into(),  name: "Panel 3-V20".into(),      dtb: "kernel-panel3.dtb".into(), is_default: false },
            Panel { id: "4".into(),  name: "Panel 4-V22".into(),      dtb: "kernel-panel4.dtb".into(), is_default: false},
            Panel { id: "5".into(),  name: "Panel 5-V22 Q8".into(),   dtb: "kernel-panel5.dtb".into(), is_default: false },
        ],
        "clone" => vec![
            Panel { id: "C1".into(),     name: "Clone 1 (ST7703)".into(),          dtb: "kernel-clone1.dtb".into(),  is_default: false },
            Panel { id: "C2".into(),     name: "Clone 2 (ST7703)".into(),          dtb: "kernel-clone2.dtb".into(),  is_default: false },
            Panel { id: "C3".into(),     name: "Clone 3 (NV3051D)".into(),         dtb: "kernel-clone3.dtb".into(),  is_default: false },
            Panel { id: "C4".into(),     name: "Clone 4 (NV3051D)".into(),         dtb: "kernel-clone4.dtb".into(),  is_default: false },
            Panel { id: "C5".into(),     name: "Clone 5 (ST7703)".into(),          dtb: "kernel-clone5.dtb".into(),  is_default: false },
            Panel { id: "C6".into(),     name: "Clone 6 (NV3051D)".into(),         dtb: "kernel-clone6.dtb".into(),  is_default: false },
            Panel { id: "C7".into(),     name: "Clone 7 (JD9365DA)".into(),        dtb: "kernel-clone7.dtb".into(),  is_default: false },
            Panel { id: "C8".into(),     name: "Clone 8 G80CA (ST7703)".into(),    dtb: "kernel-clone8.dtb".into(),  is_default: false},
            Panel { id: "C9".into(),     name: "Clone 9 (NV3051D)".into(),         dtb: "kernel-clone9.dtb".into(),  is_default: false },
            Panel { id: "C10".into(),    name: "Clone 10 (ST7703)".into(),         dtb: "kernel-clone10.dtb".into(), is_default: false },
            Panel { id: "R36Max".into(), name: "R36 Max (ST7703 720x720)".into(),  dtb: "kernel-r36max.dtb".into(),  is_default: false },
            Panel { id: "RX6S".into(),   name: "RX6S (NV3051D)".into(),            dtb: "kernel-rx6s.dtb".into(),    is_default: false },
        ],
        _ => vec![],
    }
}
