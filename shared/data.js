// ============================================================
// Hifzhelper — Quran structural data
// ============================================================
// This is the ONE place this data lives (see CONVENTIONS.md, principle 2).
// It is static — the Quran's structure doesn't change — so hardcoding it is
// correct. What matters is that it exists in exactly one file, loaded by
// both the frontend (as a plain script, for file:// portability — see
// CONVENTIONS.md on why this isn't an ES module) and the Worker (via
// require(), since Workers bundled with wrangler support CommonJS).
//
// Do not copy any of this into app.js or the Worker. Import/require this
// file instead.

const TAJWEED_DEFAULTS = ['Ghunnah','Qalqalah','Madd','Idgham','Ikhfa','Noon Sakinah','Meem Sakinah','Waqf'];

// The 114 surahs, [number, name]. Static reference data — never changes.
const SURAHS = [
  [1,'Al-Fatihah'],[2,'Al-Baqarah'],[3,'Aal-e-Imran'],[4,'An-Nisa'],[5,"Al-Ma'idah"],
  [6,"Al-An'am"],[7,"Al-A'raf"],[8,'Al-Anfal'],[9,'At-Tawbah'],[10,'Yunus'],
  [11,'Hud'],[12,'Yusuf'],[13,"Ar-Ra'd"],[14,'Ibrahim'],[15,'Al-Hijr'],
  [16,'An-Nahl'],[17,'Al-Isra'],[18,'Al-Kahf'],[19,'Maryam'],[20,'Ta-Ha'],
  [21,'Al-Anbiya'],[22,'Al-Hajj'],[23,"Al-Mu'minun"],[24,'An-Nur'],[25,'Al-Furqan'],
  [26,"Ash-Shu'ara"],[27,'An-Naml'],[28,'Al-Qasas'],[29,'Al-Ankabut'],[30,'Ar-Rum'],
  [31,'Luqman'],[32,'As-Sajdah'],[33,'Al-Ahzab'],[34,'Saba'],[35,'Fatir'],
  [36,'Ya-Sin'],[37,'As-Saffat'],[38,'Sad'],[39,'Az-Zumar'],[40,'Ghafir'],
  [41,'Fussilat'],[42,'Ash-Shura'],[43,'Az-Zukhruf'],[44,'Ad-Dukhan'],[45,'Al-Jathiyah'],
  [46,'Al-Ahqaf'],[47,'Muhammad'],[48,'Al-Fath'],[49,'Al-Hujurat'],[50,'Qaf'],
  [51,'Adh-Dhariyat'],[52,'At-Tur'],[53,'An-Najm'],[54,'Al-Qamar'],[55,'Ar-Rahman'],
  [56,"Al-Waqi'ah"],[57,'Al-Hadid'],[58,'Al-Mujadilah'],[59,'Al-Hashr'],[60,'Al-Mumtahanah'],
  [61,'As-Saff'],[62,"Al-Jumu'ah"],[63,'Al-Munafiqun'],[64,'At-Taghabun'],[65,'At-Talaq'],
  [66,'At-Tahrim'],[67,'Al-Mulk'],[68,'Al-Qalam'],[69,'Al-Haqqah'],[70,"Al-Ma'arij"],
  [71,'Nuh'],[72,'Al-Jinn'],[73,'Al-Muzzammil'],[74,'Al-Muddaththir'],[75,'Al-Qiyamah'],
  [76,'Al-Insan'],[77,'Al-Mursalat'],[78,'An-Naba'],[79,"An-Nazi'at"],[80,'Abasa'],
  [81,'At-Takwir'],[82,'Al-Infitar'],[83,'Al-Mutaffifin'],[84,'Al-Inshiqaq'],[85,'Al-Buruj'],
  [86,'At-Tariq'],[87,"Al-A'la"],[88,'Al-Ghashiyah'],[89,'Al-Fajr'],[90,'Al-Balad'],
  [91,'Ash-Shams'],[92,'Al-Layl'],[93,'Ad-Duha'],[94,'Ash-Sharh'],[95,'At-Tin'],
  [96,'Al-Alaq'],[97,'Al-Qadr'],[98,'Al-Bayyinah'],[99,'Az-Zalzalah'],[100,'Al-Adiyat'],
  [101,"Al-Qari'ah"],[102,'At-Takathur'],[103,'Al-Asr'],[104,'Al-Humazah'],[105,'Al-Fil'],
  [106,'Quraysh'],[107,"Al-Ma'un"],[108,'Al-Kawthar'],[109,'Al-Kafirun'],[110,'An-Nasr'],
  [111,'Al-Masad'],[112,'Al-Ikhlas'],[113,'Al-Falaq'],[114,'An-Nas']
];
function surahName(n){ const s = SURAHS.find(x=>x[0]===n); return s ? s[1] : ''; }

// [juz number, surah at start, ayah at start] — standard, print-independent boundaries.
const JUZ_BOUNDARIES = [
  [1,1,1],[2,2,142],[3,2,253],[4,3,92],[5,4,24],[6,4,148],[7,5,82],[8,6,111],
  [9,7,88],[10,8,41],[11,9,93],[12,11,6],[13,12,53],[14,15,1],[15,17,1],[16,18,75],
  [17,21,1],[18,23,1],[19,25,21],[20,27,56],[21,29,46],[22,33,31],[23,36,28],[24,39,32],
  [25,41,47],[26,46,1],[27,51,31],[28,58,1],[29,67,1],[30,78,1]
];
function getJuzForPosition(surah, ayah){
  surah = parseInt(surah)||1; ayah = parseInt(ayah)||1;
  let result = 1;
  for(const [juz,bS,bA] of JUZ_BOUNDARIES){
    if(surah > bS || (surah === bS && ayah >= bA)) result = juz; else break;
  }
  return result;
}
function juzStartSurah(juz){ const b = JUZ_BOUNDARIES.find(x=>x[0]===juz); return b ? b[1] : 1; }
function getJuzSurahSpan(juz){
  const start = juzStartSurah(juz);
  const next = JUZ_BOUNDARIES.find(x=>x[0]===juz+1);
  const end = next ? next[1] : 114;
  return { start, end };
}

// juz 29/30 tracked by surah; the rest (1-28) tracked by quarter.
const SURAH_TRACKED_JUZ = { 29:true, 30:true };

// Rub' boundaries (last ayah of each rub'/quarter), same surah:ayah structure for both references.
// waterval: 120 markers (4 per juz'). SOURCE: extracted and verified from the maktab's own
//   "Rub' quarters" file (Waterval 13-line print) — only the even rows of that source are real
//   Waterval quarters; odd rows were an artifact of the source template and were discarded.
//   Verified: ascending order, valid ayah counts, ends at 114:6, cross-checked against juz'-end
//   boundaries above (matches at 24/30 points; 6 juz' boundaries differ by ~1 ayah from Uthmani,
//   which is a known, real variation between print traditions, not a data error).
// uthmani: 240 markers (8 per juz' — the finer rub' al-hizb division). SOURCE: Quran Foundation
//   metadata (quran-metadata-rub.json), verified the same way.
const RUB_BOUNDARIES = {
  waterval: ["2:46","2:82","2:112","2:141","2:176","2:210","2:231","2:252","2:273","3:20","3:54","3:91","3:129","3:171","3:200","4:23","4:59","4:87","4:115","4:147","5:5","5:34","5:56","5:82","5:115","6:41","6:82","6:110","6:140","6:165","7:47","7:87","7:141","7:171","7:206","8:40","8:75","9:37","9:66","9:92","9:129","10:30","10:70","11:5","11:49","11:83","12:20","12:52","12:104","13:18","14:12","15:1","15:99","16:50","16:89","16:128","17:52","17:100","18:31","18:74","19:40","19:98","20:76","20:135","21:50","21:112","22:37","22:78","23:77","24:20","24:50","25:20","25:77","26:122","27:14","27:59","28:13","28:60","28:88","29:44","30:27","31:19","32:30","33:30","33:68","34:30","35:16","36:21","37:76","37:182","38:63","39:31","39:75","40:50","41:8","41:46","42:29","43:25","44:29","45:37","46:35","48:17","49:10","51:30","53:32","55:25","56:74","57:29","59:10","61:13","64:10","66:12","68:52","71:28","74:56","77:50","82:19","88:26","97:5","114:6"],
  uthmani: ["2:25","2:43","2:59","2:74","2:91","2:105","2:123","2:141","2:157","2:176","2:188","2:202","2:218","2:232","2:242","2:252","2:262","2:271","2:282","3:14","3:32","3:51","3:74","3:92","3:112","3:132","3:152","3:170","3:185","3:200","4:11","4:23","4:35","4:57","4:73","4:87","4:99","4:113","4:134","4:147","4:162","4:176","5:11","5:26","5:40","5:50","5:66","5:81","5:96","5:108","6:12","6:35","6:58","6:73","6:94","6:110","6:126","6:140","6:150","6:165","7:30","7:46","7:64","7:87","7:116","7:141","7:155","7:170","7:188","7:206","8:21","8:40","8:60","8:75","9:18","9:33","9:45","9:59","9:74","9:92","9:110","9:121","10:10","10:25","10:52","10:70","10:89","11:5","11:23","11:40","11:60","11:83","11:107","12:6","12:29","12:52","12:76","12:100","13:4","13:18","13:34","14:9","14:27","14:52","15:48","15:99","16:29","16:50","16:74","16:89","16:110","16:128","17:22","17:49","17:69","17:98","18:16","18:31","18:50","18:74","18:98","19:21","19:58","19:98","20:54","20:82","20:110","20:135","21:28","21:50","21:82","21:112","22:18","22:37","22:59","22:78","23:35","23:74","23:118","24:20","24:34","24:52","24:64","25:20","25:52","25:77","26:51","26:110","26:180","26:227","27:26","27:55","27:81","28:11","28:28","28:50","28:75","28:88","29:25","29:45","29:69","30:30","30:53","31:21","32:10","32:30","33:17","33:30","33:50","33:59","34:9","34:23","34:45","35:14","35:40","36:27","36:59","37:21","37:82","37:144","38:20","38:51","39:7","39:31","39:52","39:75","40:20","40:40","40:65","41:8","41:24","41:46","42:12","42:26","42:50","43:23","43:56","44:16","45:11","45:37","46:20","47:9","47:32","48:17","48:29","49:13","50:26","51:30","52:23","53:25","54:8","54:55","55:78","56:74","57:15","57:29","58:13","59:10","60:6","61:14","63:3","64:18","65:12","66:12","67:30","68:52","70:18","71:28","73:19","74:56","76:18","77:50","79:46","81:29","83:36","86:17","89:30","93:11","100:8","114:6"]
};

function compareVerseKey(s1, a1, s2, a2){
  if(s1 !== s2) return s1 - s2;
  return a1 - a2;
}
// Returns { segmentGlobal, segmentsPerJuz, juz, posInJuz } for a given surah:ayah, per the chosen reference.
// posInJuz is 1-4 for waterval (a true "quarter"), 1-8 for uthmani (a rub' al-hizb / eighth).
function getRubInfo(surah, ayah, ref){
  const list = RUB_BOUNDARIES[ref] || RUB_BOUNDARIES.waterval;
  const segmentsPerJuz = list.length / 30; // 4 for waterval, 8 for uthmani
  surah = parseInt(surah)||1; ayah = parseInt(ayah)||1;
  let segmentGlobal = list.length;
  for(let i=0;i<list.length;i++){
    const [s,a] = list[i].split(':').map(Number);
    if(compareVerseKey(surah,ayah,s,a) <= 0){ segmentGlobal = i+1; break; }
  }
  const juz = Math.ceil(segmentGlobal/segmentsPerJuz);
  const posInJuz = ((segmentGlobal-1) % segmentsPerJuz) + 1;
  return { segmentGlobal, segmentsPerJuz, juz, posInJuz };
}

// Works as a plain global-scope script in the browser (file:// safe — no ES module
// CORS restrictions) AND as a CommonJS module for the Worker (wrangler/esbuild
// supports require()). Nothing above this line needs to change either way.
if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    TAJWEED_DEFAULTS, SURAHS, surahName, JUZ_BOUNDARIES, getJuzForPosition,
    juzStartSurah, getJuzSurahSpan, SURAH_TRACKED_JUZ, RUB_BOUNDARIES,
    compareVerseKey, getRubInfo
  };
}
