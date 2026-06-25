/** Registered districts in Uganda (UBOS / MoLG reference, title-cased for display). */
const RAW_DISTRICTS = [
  "ABIM", "ADJUMANI", "AGAGO", "ALEBTONG", "AMOLATAR", "AMUDAT", "AMURIA", "AMURU", "APAC", "ARUA",
  "ARUA CITY", "BUDAKA", "BUDUDA", "BUGIRI", "BUGWERI", "BUHWEJU", "BUIKWE", "BUKEDEA", "BUKOMANSIMBI",
  "BUKWO", "BULAMBULI", "BULIISA", "BUNDIBUGYO", "BUNYANGABU", "BUSHENYI", "BUSIA", "BUTALEJA",
  "BUTAMBALA", "BUTEBO", "BUVUMA", "BUYENDE", "DOKOLO", "FORT PORTAL CITY", "GOMBA", "GULU", "GULU CITY",
  "HOIMA", "HOIMA CITY", "IBANDA", "IGANGA", "ISINGIRO", "JINJA", "JINJA CITY", "KAABONG", "KABALE",
  "KABAROLE", "KABERAMAIDO", "KAGADI", "KAKUMIRO", "KALAKI", "KALANGALA", "KALIRO", "KALUNGU", "KAMPALA",
  "KAMULI", "KAMWENGE", "KANUNGU", "KAPCHORWA", "KAPELEBYONG", "KARENGA", "KASESE", "KASSANDA", "KATAKWI",
  "KAYUNGA", "KAZO", "KIBAALE", "KIBOGA", "KIBUKU", "KIKUUBE", "KIRUHURA", "KIRYANDONGO", "KISORO",
  "KITAGWENDA", "KITGUM", "KOBOKO", "KOLE", "KOTIDO", "KUMI", "KWANIA", "KWEEN", "KYANKWANZI", "KYEGEGWA",
  "KYENJOJO", "KYOTERA", "LAMWO", "LIRA", "LIRA CITY", "LUUKA", "LUWEERO", "LWENGO", "LYANTONDE",
  "MADI-OKOLLO", "MANAFWA", "MARACHA", "MASAKA", "MASAKA CITY", "MASINDI", "MAYUGE", "MBALE", "MBALE CITY",
  "MBARARA", "MBARARA CITY", "MITOOMA", "MITYANA", "MOROTO", "MOYO", "MPIGI", "MUBENDE", "MUKONO",
  "NABILATUK", "NAKAPIRIPIRIT", "NAKASEKE", "NAKASONGOLA", "NAMAYINGO", "NAMISINDWA", "NAMUTUMBA", "NAPAK",
  "NEBBI", "NGORA", "NTOROKO", "NTUNGAMO", "NWOYA", "OBONGI", "OMORO", "OTUKE", "OYAM", "PADER", "PAKWACH",
  "PALLISA", "RAKAI", "RUBANDA", "RUBIRIZI", "RUKIGA", "RUKUNGIRI", "RWAMPARA", "SERERE", "SHEEMA",
  "SIRONKO", "SOROTI", "SOROTI CITY", "SSEMBABULE", "TEREGO", "TORORO", "WAKISO", "YUMBE", "ZOMBO",
];

function formatDistrictName(raw: string): string {
  return raw
    .split("-")
    .map((part) =>
      part
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    )
    .join("-");
}

export const UGANDA_DISTRICTS: string[] = RAW_DISTRICTS.map(formatDistrictName).sort((a, b) =>
  a.localeCompare(b),
);
