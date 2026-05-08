export interface AnimeEntry {
  slug: string;
  title: string;
  japaneseTitle?: string;
  synopsis: string;
  episodes: string;
  genres: string[];
  related: string[];
}

export const animeList: AnimeEntry[] = [
  {
    slug: "attack-on-titan",
    title: "Attack on Titan",
    japaneseTitle: "Shingeki no Kyojin",
    synopsis:
      "Humanity fights for survival against giant humanoid Titans that have pushed civilization to the brink of extinction. Eren Yeager and the Survey Corps uncover the truth behind the Titans and the walls that protect them.",
    episodes: "87 episodes across 4 seasons",
    genres: ["Action", "Dark Fantasy", "Post-Apocalyptic"],
    related: ["demon-slayer", "jujutsu-kaisen", "vinland-saga"],
  },
  {
    slug: "one-piece",
    title: "One Piece",
    japaneseTitle: "Wan Pīsu",
    synopsis:
      "Monkey D. Luffy and the Straw Hat Pirates sail the Grand Line in search of the legendary treasure One Piece. A sprawling adventure of friendship, freedom, and epic battles across the seas.",
    episodes: "1100+ episodes and counting",
    genres: ["Adventure", "Action", "Comedy"],
    related: ["naruto", "dragon-ball-super", "fairy-tail"],
  },
  {
    slug: "demon-slayer",
    title: "Demon Slayer: Kimetsu no Yaiba",
    japaneseTitle: "Kimetsu no Yaiba",
    synopsis:
      "Tanjiro Kamado becomes a demon slayer to avenge his family and cure his sister Nezuko who was turned into a demon. Stunning animation and intense sword combat define this modern classic.",
    episodes: "55+ episodes across multiple seasons",
    genres: ["Action", "Supernatural", "Historical"],
    related: ["attack-on-titan", "jujutsu-kaisen", "chainsaw-man"],
  },
  {
    slug: "jujutsu-kaisen",
    title: "Jujutsu Kaisen",
    japaneseTitle: "Jujutsu Kaisen",
    synopsis:
      "Yuji Itadori joins Tokyo Jujutsu High to fight cursed spirits after swallowing a powerful cursed object. Dark sorcery, brutal fights, and complex characters define this modern shonen hit.",
    episodes: "47+ episodes across 2 seasons",
    genres: ["Action", "Supernatural", "Dark Fantasy"],
    related: ["chainsaw-man", "demon-slayer", "attack-on-titan"],
  },
  {
    slug: "chainsaw-man",
    title: "Chainsaw Man",
    japaneseTitle: "Chensō Man",
    synopsis:
      "Denji, a poverty-stricken devil hunter, merges with his chainsaw devil pet to become Chainsaw Man. A wild, bloody ride through a world of devils and devil hunters.",
    episodes: "12+ episodes (Season 1)",
    genres: ["Action", "Dark Fantasy", "Horror"],
    related: ["jujutsu-kaisen", "mob-psycho-100", "dorohedoro"],
  },
  {
    slug: "solo-leveling",
    title: "Solo Leveling",
    japaneseTitle: "Ore dake Level Up na Ken",
    synopsis:
      "Sung Jinwoo, the weakest hunter in a world of dungeon portals, gains a mysterious system that lets him level up without limit. From zero to the strongest shadow monarch.",
    episodes: "12+ episodes (Season 1)",
    genres: ["Action", "Fantasy", "Adventure"],
    related: ["the-beginning-after-the-end", "tower-of-god", "one-punch-man"],
  },
  {
    slug: "frieren-beyond-journeys-end",
    title: "Frieren: Beyond Journey's End",
    japaneseTitle: "Sōsō no Frieren",
    synopsis:
      "After the demon king is defeated, the elven mage Frieren realizes she barely knew her human companions. A poignant story about time, memory, and what it means to understand others.",
    episodes: "28 episodes (Season 1)",
    genres: ["Adventure", "Fantasy", "Drama"],
    related: ["mushoku-tensei", "violet-evergarden", "made-in-abyss"],
  },
  {
    slug: "dandadan",
    title: "Dan Da Dan",
    japaneseTitle: "Dandadan",
    synopsis:
      "A girl who believes in ghosts and a boy who believes in aliens team up when both turn out to be real. Hilarious, action-packed, and surprisingly heartfelt.",
    episodes: "12+ episodes (Season 1)",
    genres: ["Action", "Comedy", "Supernatural"],
    related: ["mob-psycho-100", "chainsaw-man", "undead-unluck"],
  },
  {
    slug: "my-hero-academia",
    title: "My Hero Academia",
    japaneseTitle: "Boku no Hero Academia",
    synopsis:
      "In a world where most people have superpowers called Quirks, Izuku Midoriya is born without one but dreams of becoming the greatest hero. His journey at U.A. High School begins.",
    episodes: "138+ episodes across multiple seasons",
    genres: ["Action", "Superhero", "School"],
    related: ["naruto", "black-clover", "one-punch-man"],
  },
  {
    slug: "naruto",
    title: "Naruto / Naruto Shippuden",
    japaneseTitle: "Naruto",
    synopsis:
      "Naruto Uzumaki, a young ninja shunned by his village, works tirelessly to become Hokage and earn everyone's respect. An epic saga of friendship, rivalry, and ninja warfare.",
    episodes: "720 episodes (Naruto + Shippuden)",
    genres: ["Action", "Adventure", "Martial Arts"],
    related: ["one-piece", "dragon-ball-super", "bleach"],
  },
  {
    slug: "spy-x-family",
    title: "Spy x Family",
    japaneseTitle: "Supai Famirī",
    synopsis:
      "A spy, an assassin, and a telepathic child form a fake family — each hiding their true identity. Heartwarming comedy meets espionage action.",
    episodes: "37+ episodes across 2 seasons",
    genres: ["Comedy", "Action", "Slice of Life"],
    related: ["kaguya-sama", "the-apothecary-diaries", "odd-taxi"],
  },
  {
    slug: "the-apothecary-diaries",
    title: "The Apothecary Diaries",
    japaneseTitle: "Kusuriya no Hitorigoto",
    synopsis:
      "Maomao, a pharmacist's daughter sold into servitude at the imperial court, uses her medical knowledge to solve mysteries and uncover palace intrigues.",
    episodes: "24+ episodes",
    genres: ["Mystery", "Historical", "Drama"],
    related: ["spy-x-family", "frieren-beyond-journeys-end", "violet-evergarden"],
  },
  {
    slug: "bleach",
    title: "Bleach / Bleach: Thousand-Year Blood War",
    japaneseTitle: "Burīchi",
    synopsis:
      "Ichigo Kurosaki gains Soul Reaper powers and protects the living world from evil spirits. The Thousand-Year Blood War arc brings the epic final battle.",
    episodes: "366+ episodes (original + TYBW)",
    genres: ["Action", "Supernatural", "Adventure"],
    related: ["naruto", "dragon-ball-super", "one-piece"],
  },
  {
    slug: "dragon-ball-super",
    title: "Dragon Ball Super",
    japaneseTitle: "Doragon Bōru Sūpā",
    synopsis:
      "Goku and friends face new universal threats, unlocking god-level power in tournaments that shake the multiverse. The legendary franchise continues.",
    episodes: "131 episodes + movies",
    genres: ["Action", "Martial Arts", "Comedy"],
    related: ["one-piece", "naruto", "my-hero-academia"],
  },
  {
    slug: "one-punch-man",
    title: "One Punch Man",
    japaneseTitle: "Wanpanman",
    synopsis:
      "Saitama can defeat any enemy with a single punch, but he's bored. A satirical take on superhero and shonen tropes with incredible animation.",
    episodes: "24+ episodes across 2 seasons",
    genres: ["Action", "Comedy", "Superhero"],
    related: ["mob-psycho-100", "my-hero-academia", "solo-leveling"],
  },
  {
    slug: "mob-psycho-100",
    title: "Mob Psycho 100",
    japaneseTitle: "Mobu Saiko Hyaku",
    synopsis:
      "Shigeo 'Mob' Kageyama is an incredibly powerful psychic who just wants to live a normal life. But his powers keep dragging him into supernatural battles.",
    episodes: "37 episodes across 3 seasons",
    genres: ["Action", "Comedy", "Supernatural"],
    related: ["one-punch-man", "dandadan", "saiki-k"],
  },
  {
    slug: "fullmetal-alchemist-brotherhood",
    title: "Fullmetal Alchemist: Brotherhood",
    japaneseTitle: "Hagane no Renkinjutsushi",
    synopsis:
      "Brothers Edward and Alphonse Elric use alchemy to search for the Philosopher's Stone after a failed attempt to resurrect their mother. A masterpiece of storytelling.",
    episodes: "64 episodes",
    genres: ["Action", "Adventure", "Drama"],
    related: ["hunter-x-hunter", "steins-gate", "code-geass"],
  },
  {
    slug: "hunter-x-hunter",
    title: "Hunter x Hunter",
    japaneseTitle: "Hantā Hantā",
    synopsis:
      "Gon Freecss becomes a Hunter to find his absent father, navigating a world of complex power systems, moral ambiguity, and unforgettable arcs.",
    episodes: "148 episodes (2011 version)",
    genres: ["Action", "Adventure", "Fantasy"],
    related: ["fullmetal-alchemist-brotherhood", "yu-yu-hakusho", "jujutsu-kaisen"],
  },
  {
    slug: "death-note",
    title: "Death Note",
    japaneseTitle: "Desu Nōto",
    synopsis:
      "A brilliant student finds a supernatural notebook that kills anyone whose name is written in it. A cat-and-mouse thriller between Light Yagami and detective L.",
    episodes: "37 episodes",
    genres: ["Thriller", "Supernatural", "Psychological"],
    related: ["code-geass", "steins-gate", "monster"],
  },
  {
    slug: "steins-gate",
    title: "Steins;Gate",
    japaneseTitle: "Shutainzu Gēto",
    synopsis:
      "Self-proclaimed mad scientist Okabe Rintaro discovers time travel via a modified microwave. What starts as fun experiments becomes a desperate fight to save those he loves.",
    episodes: "24 + 24 episodes (including Steins;Gate 0)",
    genres: ["Sci-Fi", "Thriller", "Drama"],
    related: ["death-note", "erased", "re-zero"],
  },
  {
    slug: "vinland-saga",
    title: "Vinland Saga",
    japaneseTitle: "Vinrando Saga",
    synopsis:
      "Young Viking Thorfinn seeks revenge against the man who killed his father, but the journey leads to a deeper quest for peace in a world of war.",
    episodes: "48 episodes across 2 seasons",
    genres: ["Action", "Historical", "Drama"],
    related: ["attack-on-titan", "berserk", "kingdom"],
  },
  {
    slug: "mushoku-tensei",
    title: "Mushoku Tensei: Jobless Reincarnation",
    japaneseTitle: "Mushoku Tensei",
    synopsis:
      "A man gets a second chance at life when he's reincarnated in a fantasy world. Determined not to waste it, Rudeus Greyrat grows into a powerful mage.",
    episodes: "34+ episodes across 2 seasons",
    genres: ["Fantasy", "Adventure", "Isekai"],
    related: ["re-zero", "frieren-beyond-journeys-end", "konosuba"],
  },
  {
    slug: "re-zero",
    title: "Re:Zero − Starting Life in Another World",
    japaneseTitle: "Re:Zero kara Hajimeru Isekai Seikatsu",
    synopsis:
      "Subaru Natsuki is transported to a fantasy world where he discovers he can return from death. Each loop brings new horrors and the chance to save those he cares about.",
    episodes: "50+ episodes across 2 seasons",
    genres: ["Fantasy", "Thriller", "Isekai"],
    related: ["mushoku-tensei", "steins-gate", "konosuba"],
  },
  {
    slug: "violet-evergarden",
    title: "Violet Evergarden",
    japaneseTitle: "Vaioretto Evāgāden",
    synopsis:
      "A former child soldier learns to write letters for others and discovers the meaning of love. Breathtaking visuals and deeply emotional storytelling.",
    episodes: "13 episodes + 2 movies",
    genres: ["Drama", "Fantasy", "Slice of Life"],
    related: ["frieren-beyond-journeys-end", "the-apothecary-diaries", "a-silent-voice"],
  },
  {
    slug: "made-in-abyss",
    title: "Made in Abyss",
    japaneseTitle: "Meido in Abisu",
    synopsis:
      "Riko descends into a massive, mysterious chasm with her robot companion Reg to find her mother. Beautiful yet brutal, the Abyss hides wonders and horrors in equal measure.",
    episodes: "25+ episodes across 2 seasons",
    genres: ["Adventure", "Fantasy", "Sci-Fi"],
    related: ["frieren-beyond-journeys-end", "hunter-x-hunter", "the-promised-neverland"],
  },
  {
    slug: "code-geass",
    title: "Code Geass: Lelouch of the Rebellion",
    japaneseTitle: "Kōdo Giasu",
    synopsis:
      "Exiled prince Lelouch gains the power of absolute obedience and leads a rebellion against the Holy Britannian Empire. Strategy, mecha, and a legendary ending.",
    episodes: "50 episodes across 2 seasons",
    genres: ["Mecha", "Thriller", "Action"],
    related: ["death-note", "steins-gate", "neon-genesis-evangelion"],
  },
  {
    slug: "neon-genesis-evangelion",
    title: "Neon Genesis Evangelion",
    japaneseTitle: "Shin Seiki Evangerion",
    synopsis:
      "Teenagers pilot giant bio-mechs to fight mysterious Angels threatening humanity. Beneath the mecha action lies a profound exploration of depression, identity, and human connection.",
    episodes: "26 episodes + movies",
    genres: ["Mecha", "Psychological", "Sci-Fi"],
    related: ["code-geass", "serial-experiments-lain", "steins-gate"],
  },
  {
    slug: "cowboy-bebop",
    title: "Cowboy Bebop",
    japaneseTitle: "Kaubōi Bibappu",
    synopsis:
      "Bounty hunters Spike, Jet, Faye, and Ed roam the solar system in their ship Bebop. Jazz, noir, and unforgettable style make this a timeless classic.",
    episodes: "26 episodes + movie",
    genres: ["Action", "Sci-Fi", "Neo-Noir"],
    related: ["samurai-champloo", "trigun", "space-dandy"],
  },
  {
    slug: "tokyo-revengers",
    title: "Tokyo Revengers",
    japaneseTitle: "Tōkyō Ribenjāzu",
    synopsis:
      "Takemichi Hanagaki can leap back in time to his middle school days. He uses this power to save his ex-girlfriend by changing the fate of a dangerous gang.",
    episodes: "37+ episodes across 2 seasons",
    genres: ["Action", "Thriller", "Time Travel"],
    related: ["erased", "steins-gate", "tokyo-ghoul"],
  },
  {
    slug: "black-clover",
    title: "Black Clover",
    japaneseTitle: "Burakku Kurōbā",
    synopsis:
      "In a world of magic, Asta is born without any. But his anti-magic abilities and relentless determination drive him to become the Wizard King.",
    episodes: "170 episodes + movie",
    genres: ["Action", "Fantasy", "Shonen"],
    related: ["my-hero-academia", "naruto", "fairy-tail"],
  },
  {
    slug: "tower-of-god",
    title: "Tower of God",
    japaneseTitle: "Kami no Tō",
    synopsis:
      "Bam enters the mysterious Tower to find his best friend Rachel. Each floor presents deadly tests, alliances, and betrayals as climbers compete for ultimate power.",
    episodes: "13+ episodes",
    genres: ["Action", "Fantasy", "Mystery"],
    related: ["solo-leveling", "hunter-x-hunter", "made-in-abyss"],
  },
  {
    slug: "kaguya-sama",
    title: "Kaguya-sama: Love Is War",
    japaneseTitle: "Kaguya-sama wa Kokurasetai",
    synopsis:
      "Two brilliant student council members are in love but too proud to confess. Every day becomes a psychological battle to make the other one crack first.",
    episodes: "37 episodes across 3 seasons",
    genres: ["Comedy", "Romance", "School"],
    related: ["spy-x-family", "quintessential-quintuplets", "horimiya"],
  },
  {
    slug: "bocchi-the-rock",
    title: "Bocchi the Rock!",
    japaneseTitle: "Bocchi Za Rokku!",
    synopsis:
      "Hitori 'Bocchi' Gotoh is an extremely shy guitar prodigy who dreams of being in a band. When she finally joins one, hilarity and heartfelt moments ensue.",
    episodes: "12 episodes",
    genres: ["Comedy", "Music", "Slice of Life"],
    related: ["kaguya-sama", "k-on", "keep-your-hands-off-eizouken"],
  },
  {
    slug: "oshi-no-ko",
    title: "Oshi no Ko",
    japaneseTitle: "Oshi no Ko",
    synopsis:
      "A doctor reincarnates as the son of his favorite idol and uncovers the dark side of the entertainment industry while seeking the truth behind his mother's death.",
    episodes: "23+ episodes across 2 seasons",
    genres: ["Drama", "Supernatural", "Mystery"],
    related: ["spy-x-family", "the-apothecary-diaries", "kaguya-sama"],
  },
  {
    slug: "sword-art-online",
    title: "Sword Art Online",
    japaneseTitle: "Sōdo Āto Onrain",
    synopsis:
      "Players are trapped in a virtual reality MMORPG where dying in-game means dying in real life. Kirito fights to clear the game and free everyone.",
    episodes: "96+ episodes across multiple seasons",
    genres: ["Action", "Sci-Fi", "Isekai"],
    related: ["re-zero", "mushoku-tensei", "tower-of-god"],
  },
  {
    slug: "tokyo-ghoul",
    title: "Tokyo Ghoul",
    japaneseTitle: "Tōkyō Gūru",
    synopsis:
      "Ken Kaneki becomes a half-ghoul after a near-fatal encounter and must navigate life between the human and ghoul worlds in a dark, violent Tokyo.",
    episodes: "48 episodes across 4 seasons",
    genres: ["Action", "Horror", "Psychological"],
    related: ["parasyte", "attack-on-titan", "death-note"],
  },
  {
    slug: "konosuba",
    title: "KonoSuba: God's Blessing on This Wonderful World!",
    japaneseTitle: "Kono Subarashii Sekai ni Shukufuku wo!",
    synopsis:
      "After dying, Kazuma is reincarnated in a fantasy world with a useless goddess. Together with their dysfunctional party, they stumble through quests in hilarious fashion.",
    episodes: "20+ episodes across 3 seasons",
    genres: ["Comedy", "Fantasy", "Isekai"],
    related: ["mushoku-tensei", "re-zero", "overlord"],
  },
  {
    slug: "haikyuu",
    title: "Haikyuu!!",
    japaneseTitle: "Haikyū!!",
    synopsis:
      "Short but determined Shoyo Hinata joins Karasuno High's volleyball team and partners with genius setter Tobio Kageyama. An electrifying sports anime about teamwork and growth.",
    episodes: "85 episodes across 4 seasons + movies",
    genres: ["Sports", "Drama", "Comedy"],
    related: ["kuroko-no-basket", "blue-lock", "slam-dunk"],
  },
  {
    slug: "blue-lock",
    title: "Blue Lock",
    japaneseTitle: "Burū Rokku",
    synopsis:
      "300 young strikers are locked in a ruthless facility to produce Japan's ultimate goal-scorer. Ego, rivalry, and raw talent collide in this intense soccer anime.",
    episodes: "24+ episodes",
    genres: ["Sports", "Drama", "Psychological"],
    related: ["haikyuu", "kuroko-no-basket", "megalo-box"],
  },
  {
    slug: "undead-unluck",
    title: "Undead Unluck",
    japaneseTitle: "Andeddo Anrakku",
    synopsis:
      "A girl cursed with catastrophic unluck teams up with an undying man. Together they battle against the rules of their universe in a wild, creative action series.",
    episodes: "24 episodes",
    genres: ["Action", "Supernatural", "Comedy"],
    related: ["dandadan", "chainsaw-man", "jujutsu-kaisen"],
  },
  {
    slug: "that-time-i-got-reincarnated-as-a-slime",
    title: "That Time I Got Reincarnated as a Slime",
    japaneseTitle: "Tensei Shitara Slime Datta Ken",
    synopsis:
      "A businessman reincarnates as a slime in a fantasy world and builds a nation of monsters. Surprisingly wholesome world-building meets overpowered protagonist fun.",
    episodes: "48+ episodes across 2 seasons",
    genres: ["Fantasy", "Adventure", "Isekai"],
    related: ["mushoku-tensei", "overlord", "konosuba"],
  },
  {
    slug: "dr-stone",
    title: "Dr. Stone",
    japaneseTitle: "Dokutā Sutōn",
    synopsis:
      "After all of humanity is petrified for thousands of years, genius scientist Senku revives and sets out to rebuild civilization from scratch using science.",
    episodes: "47+ episodes across 3 seasons",
    genres: ["Adventure", "Sci-Fi", "Comedy"],
    related: ["fullmetal-alchemist-brotherhood", "my-hero-academia", "fire-force"],
  },
  {
    slug: "dororo",
    title: "Dororo",
    japaneseTitle: "Dororo",
    synopsis:
      "A ronin born without limbs, skin, or organs fights demons to reclaim his stolen body parts. A dark, atmospheric retelling of Osamu Tezuka's classic.",
    episodes: "24 episodes",
    genres: ["Action", "Historical", "Supernatural"],
    related: ["vinland-saga", "berserk", "demon-slayer"],
  },
  {
    slug: "dorohedoro",
    title: "Dorohedoro",
    japaneseTitle: "Dorohedoro",
    synopsis:
      "In a grimy world divided between sorcerers and their victims, a reptile-headed man searches for the sorcerer who cursed him. Violent, weird, and utterly unique.",
    episodes: "12 episodes",
    genres: ["Action", "Dark Fantasy", "Comedy"],
    related: ["chainsaw-man", "mob-psycho-100", "jujutsu-kaisen"],
  },
  {
    slug: "fire-force",
    title: "Fire Force",
    japaneseTitle: "Enen no Shōbōtai",
    synopsis:
      "Shinra Kusakabe joins Special Fire Force Company 8 to fight Infernals — people who spontaneously combust — and uncover the truth behind the phenomenon.",
    episodes: "48 episodes across 2 seasons",
    genres: ["Action", "Supernatural", "Shonen"],
    related: ["my-hero-academia", "dr-stone", "soul-eater"],
  },
  {
    slug: "overlord",
    title: "Overlord",
    japaneseTitle: "Ōbārōdo",
    synopsis:
      "When his favorite MMORPG shuts down, Momonga stays logged in and becomes his max-level undead character in a real new world. A dark isekai of world domination.",
    episodes: "52 episodes across 4 seasons",
    genres: ["Action", "Fantasy", "Isekai"],
    related: ["that-time-i-got-reincarnated-as-a-slime", "konosuba", "re-zero"],
  },
  {
    slug: "berserk",
    title: "Berserk",
    japaneseTitle: "Beruseruku",
    synopsis:
      "The Black Swordsman Guts wields an enormous sword and battles demons in a dark medieval world. A tale of ambition, betrayal, and relentless survival.",
    episodes: "25 episodes (1997) + 24 (2016-17)",
    genres: ["Action", "Dark Fantasy", "Horror"],
    related: ["vinland-saga", "dororo", "claymore"],
  },
  {
    slug: "parasyte",
    title: "Parasyte: The Maxim",
    japaneseTitle: "Kiseijū: Sei no Kakuritsu",
    synopsis:
      "Alien parasites invade Earth and take over human brains. High schooler Shinichi's right hand is taken over by one, and the two must coexist to survive.",
    episodes: "24 episodes",
    genres: ["Action", "Horror", "Sci-Fi"],
    related: ["tokyo-ghoul", "death-note", "attack-on-titan"],
  },
  {
    slug: "erased",
    title: "Erased (Boku dake ga Inai Machi)",
    japaneseTitle: "Boku dake ga Inai Machi",
    synopsis:
      "A man with the ability to travel back in time must prevent a kidnapping and murder from his childhood. A gripping mystery-thriller with emotional depth.",
    episodes: "12 episodes",
    genres: ["Mystery", "Thriller", "Drama"],
    related: ["steins-gate", "death-note", "tokyo-revengers"],
  },
  {
    slug: "hells-paradise",
    title: "Hell's Paradise: Jigokuraku",
    japaneseTitle: "Jigokuraku",
    synopsis:
      "Death-row ninja Gabimaru the Hollow is sent to a mysterious island to retrieve the elixir of immortality. Brutal fights, grotesque monsters, and a ticking clock make every episode a pressure cooker—perfect for a watchroom that loves hype and debate.",
    episodes: "13 episodes (Season 1)",
    genres: ["Action", "Supernatural", "Historical"],
    related: ["chainsaw-man", "jujutsu-kaisen", "demon-slayer"],
  },
  {
    slug: "jojos-bizarre-adventure",
    title: "JoJo's Bizarre Adventure",
    japaneseTitle: "JoJo no Kimyou na Bouken (TV)",
    synopsis:
      "The Joestar bloodline inherits bizarre psychic powers—and deadly rivals—across generations. From Victorian intrigue to globe-trotting showdowns, each arc remixes genre with unforgettable poses, fights, and cliffhangers built for live reactions.",
    episodes: "Season 1 (Phantom Blood / Battle Tendency): 26 episodes; franchise continues across multiple cours",
    genres: ["Action", "Adventure", "Supernatural"],
    related: ["demon-slayer", "jujutsu-kaisen", "hunter-x-hunter"],
  },
  {
    slug: "gurren-lagann",
    title: "Gurren Lagann",
    japaneseTitle: "Tengen Toppa Gurren Lagann",
    synopsis:
      "Simon and Kamina drill upward from an underground village toward the surface—and keep escalating against impossible odds. Pure-hearted hype, giant robots, and speeches that reward shouting back at the screen with friends.",
    episodes: "27 episodes",
    genres: ["Action", "Mecha", "Sci-Fi"],
    related: ["neon-genesis-evangelion", "fullmetal-alchemist-brotherhood", "attack-on-titan"],
  },
  {
    slug: "the-promised-neverland",
    title: "The Promised Neverland",
    japaneseTitle: "Yakusoku no Neverland",
    synopsis:
      "Orphans Emma, Norman, and Ray discover their idyllic farm hides a horrifying truth. Every revelation reshuffles alliances—ideal for watchrooms that love theorizing between episodes.",
    episodes: "23 episodes across 2 seasons",
    genres: ["Mystery", "Thriller", "Sci-Fi"],
    related: ["erased", "death-note", "tokyo-ghoul"],
  },
  {
    slug: "blue-exorcist",
    title: "Blue Exorcist",
    japaneseTitle: "Ao no Exorcist",
    synopsis:
      "Rin Okumura learns he is the son of Satan but trains as an exorcist alongside his twin Yukio. Demon hunts, academy rivalries, and brotherhood tension fuel binge-friendly arcs.",
    episodes: "37+ episodes across multiple seasons",
    genres: ["Action", "Supernatural", "School"],
    related: ["demon-slayer", "jujutsu-kaisen", "bleach"],
  },
  {
    slug: "no-game-no-life",
    title: "No Game, No Life",
    japaneseTitle: "No Game No Life",
    synopsis:
      "Shut-in gamer siblings Shiro and Sora are summoned to Disboard, where every conflict is settled by games. Rule-bending gambits and candy-colored chaos pair well with group commentary.",
    episodes: "12 episodes + movie",
    genres: ["Adventure", "Comedy", "Fantasy"],
    related: ["sword-art-online", "konosuba", "that-time-i-got-reincarnated-as-a-slime"],
  },
  {
    slug: "food-wars-shokugeki-no-soma",
    title: "Food Wars! Shokugeki no Soma",
    japaneseTitle: "Shokugeki no Souma",
    synopsis:
      "Yukihira Soma enters an elite culinary academy where formal duels decide reputations—often with theatrical flair. Competitive tension and mouthwatering visuals make every episode an event.",
    episodes: "85 episodes across multiple seasons",
    genres: ["Comedy", "School", "Shounen"],
    related: ["haikyuu", "kaguya-sama", "my-hero-academia"],
  },
  {
    slug: "classroom-of-the-elite",
    title: "Classroom of the Elite",
    japaneseTitle: "Youkoso Jitsuryoku Shijou Shugi no Kyoushitsu e",
    synopsis:
      "Tokyo Metropolitan Advanced Nurturing High School ranks classes ruthlessly. Quiet protagonist Kiyotaka navigates exams and schemes while classmates underestimate him—fuel for pause-and-debate moments.",
    episodes: "39+ episodes across multiple seasons",
    genres: ["Drama", "Psychological", "School"],
    related: ["kaguya-sama", "death-note", "steins-gate"],
  },
  {
    slug: "toradora",
    title: "Toradora!",
    japaneseTitle: "Toradora!",
    synopsis:
      "Ryuji and Taiga strike a pact to help each other confess to their crushes—until feelings blur. Sharp comedy and emotional payoffs land hardest when watched with friends who argue ships.",
    episodes: "25 episodes",
    genres: ["Comedy", "Romance", "Slice of Life"],
    related: ["kaguya-sama", "spy-x-family", "bocchi-the-rock"],
  },
  {
    slug: "ranking-of-kings",
    title: "Ranking of Kings",
    japaneseTitle: "Ousama Ranking",
    synopsis:
      "Deaf prince Bojji aims to become king despite ridicule from court and kingdoms. Fairy-tale framing hides muscular storytelling—perfect for rooms that cheer underdog arcs together.",
    episodes: "23 episodes (Season 1)",
    genres: ["Adventure", "Fantasy", "Drama"],
    related: ["made-in-abyss", "violet-evergarden", "frieren-beyond-journeys-end"],
  },
  {
    slug: "dragon-ball-z",
    title: "Dragon Ball Z",
    japaneseTitle: "Dragon Ball Z",
    synopsis:
      "Goku and the Z Fighters defend Earth from aliens, androids, and world-ending villains. Transformation reveals, beam struggles, and tournament hype are engraved in anime history—ideal for synchronized hype or async catch-up threads.",
    episodes: "291 episodes",
    genres: ["Action", "Adventure", "Sci-Fi"],
    related: ["dragon-ball-super", "naruto", "one-piece"],
  },
  {
    slug: "my-dress-up-darling",
    title: "My Dress-Up Darling",
    japaneseTitle: "Sono Bisque Doll wa Koi wo Suru",
    synopsis:
      "Quiet hobby craftsman Wakana Gojo hides his passion for traditional dolls until loud, popular Marin Kitagawa discovers his sewing skill and recruits him for cosplay—starting with a brazen hallway pitch that flips his entire social orbit. Every fitting becomes half comedy roast and half sincere craft nerd-out; when Marin tears through fabric mishaps or Gojo freezes mid-confession, your watch party has endless pause-worthy beats.",
    episodes: "24+ episodes across multiple seasons",
    genres: ["Romance", "Comedy", "Slice of Life"],
    related: ["kaguya-sama", "toradora", "bocchi-the-rock"],
  },
  {
    slug: "gintama",
    title: "Gintama",
    japaneseTitle: "Gintama",
    synopsis:
      "In an alternate Edo occupied by aliens, odd-job freelancer Gintoki Sakata drags his crew through parody-heavy crises that swing from toilet humor to genuinely brutal arcs. The tonal whiplash rewards a watchroom that loves riffing on tropes—then suddenly locking in for a serious sword fight.",
    episodes: "367+ episodes across multiple cours (2006–2018)",
    genres: ["Action", "Comedy", "Sci-Fi"],
    related: ["cowboy-bebop", "naruto", "konosuba"],
  },
  {
    slug: "yu-yu-hakusho",
    title: "Yu Yu Hakusho",
    japaneseTitle: "Yū Yū Hakusho",
    synopsis:
      "Teen delinquent Yusuke Urameshi dies saving a child, earns a second shot as Spirit Detective, and dives into tournaments and demon politics with Kuwabara, Kurama, and Hiei. Classic arc-style plotting makes it easy to sync episode batches or debate power rankings between fights.",
    episodes: "112 episodes",
    genres: ["Action", "Supernatural", "Adventure"],
    related: ["hunter-x-hunter", "naruto", "dragon-ball-z"],
  },
  {
    slug: "samurai-champloo",
    title: "Samurai Champloo",
    japaneseTitle: "Samurai Chanpurū",
    synopsis:
      "Fuu hires two swordsmen who can't stand each other—wild Mugen and disciplined Jin—for a road trip across Edo-era Japan scored like a beat tape. Hip-hop rhythm and episodic detours give your group plenty of style points to react to without losing the central mystery of the sunflower samurai.",
    episodes: "26 episodes",
    genres: ["Action", "Adventure", "Historical"],
    related: ["cowboy-bebop", "dororo", "vinland-saga"],
  },
  {
    slug: "inuyasha",
    title: "Inuyasha",
    japaneseTitle: "Inuyasha",
    synopsis:
      "Modern-day Kagome falls into Japan's feudal past and teams up with the dog-eared half-demon Inuyasha to recover shattered Jewel shards before demons hoard them. Long arcs and monster-of-the-week pockets mean async buddies can catch up anytime while marathoners trade theories about the next twist.",
    episodes: "167 episodes + Inuyasha: The Final Act",
    genres: ["Action", "Adventure", "Fantasy"],
    related: ["frieren-beyond-journeys-end", "demon-slayer", "bleach"],
  },
  {
    slug: "kaiju-no-8",
    title: "Kaiju No. 8",
    japaneseTitle: "Kaijuu 8-gou",
    synopsis:
      "Kafka Hibino cleans up after kaiju battles until he gains the ability to transform into one himself—and still dreams of joining the elite Defense Force. Giant-monster brawls and paperwork-aged jokes alternate fast enough that watchrooms can cheer every punch-up together.",
    episodes: "12+ episodes (Season 1)",
    genres: ["Action", "Sci-Fi", "Supernatural"],
    related: ["my-hero-academia", "chainsaw-man", "solo-leveling"],
  },
  {
    slug: "eighty-six",
    title: "86: Eighty Six",
    japaneseTitle: "Eighty Six",
    synopsis:
      "On a wartorn continent, silver-haired pilots labeled \"86\" fight drones from exile while handlers far from the front pretend it's clean. Morally heavy sorties and stunning action blocks land hardest when you debrief with friends between missions.",
    episodes: "23 episodes across 2 cours (Parts 1 & 2)",
    genres: ["Action", "Drama", "Sci-Fi"],
    related: ["code-geass", "attack-on-titan", "vinland-saga"],
  },
  {
    slug: "lycoris-recoil",
    title: "Lycoris Recoil",
    japaneseTitle: "Rikorisu Rikoiru",
    synopsis:
      "Covert teen agents Chisato and Takina balance café shifts with ultra-clean gun battles around Tokyo. Buddy energy, café downtime, and slick choreography make every outing easy to queue for a casual co-watch night.",
    episodes: "13 episodes",
    genres: ["Action", "Sci-Fi", "Slice of Life"],
    related: ["spy-x-family", "chainsaw-man", "tokyo-revengers"],
  },
  {
    slug: "mashle",
    title: "Mashle: Magic and Muscles",
    japaneseTitle: "Mashle",
    synopsis:
      "In a wizard society, Mash Burnedead has zero spells—just absurd strength—and enrolls in magic school anyway to protect his adoptive father. Deadpan gags and tournament absurdism invite everyone in the room to yell at the screen whenever Mash curls instead of casting.",
    episodes: "12+ episodes across multiple seasons",
    genres: ["Action", "Comedy", "Fantasy"],
    related: ["my-hero-academia", "black-clover", "konosuba"],
  },
  {
    slug: "wind-breaker",
    title: "Wind Breaker",
    japaneseTitle: "Wind Breaker",
    synopsis:
      "Haruka Sakura joins Furin High expecting turf-war chaos but finds a crew that channels street fights into defending their town. Fast punches and found-family bonding suit viewers who like syncing hype fights then rewinding the best combinations.",
    episodes: "13+ episodes",
    genres: ["Action", "School", "Drama"],
    related: ["tokyo-revengers", "blue-lock", "haikyuu"],
  },
  {
    slug: "great-teacher-onizuka",
    title: "Great Teacher Onizuka",
    japaneseTitle: "Great Teacher Onizuka",
    synopsis:
      "Former gang legend Eikichi Onizuka becomes a teacher mostly for lazy reasons—and ends up confronting bullying, pressure, and hypocrisy with reckless heart. Older-school humor aside, his big speeches still pause the chat so everyone can argue whether he'd survive a modern classroom.",
    episodes: "43 episodes",
    genres: ["Comedy", "Drama", "School"],
    related: ["classroom-of-the-elite", "kaguya-sama", "food-wars-shokugeki-no-soma"],
  },
  {
    slug: "psycho-pass",
    title: "Psycho-Pass",
    japaneseTitle: "Psycho-Pass",
    synopsis:
      "In a near-future Japan, the Sibyl System quantifies every citizen's crime potential before it happens. Inspectors and Enforcers chase latent criminals in cases that escalate from procedural tension to full systemic moral collapse—ideal for a watchroom that loves debating justice between episodes.",
    episodes: "22 episodes (Season 1) + sequels and films",
    genres: ["Sci-Fi", "Thriller", "Psychological"],
    related: ["death-note", "steins-gate", "tokyo-ghoul"],
  },
  {
    slug: "monster",
    title: "Monster",
    japaneseTitle: "Monster",
    synopsis:
      "Brilliant surgeon Dr. Kenzo Tenma saves a boy instead of a politician—and years later learns that act may have nurtured a manipulative killer. Slow-burn psychological noir rewards patient groups who treat each arc like a weekly true-crime debrief.",
    episodes: "74 episodes",
    genres: ["Thriller", "Psychological", "Mystery"],
    related: ["death-note", "erased", "parasyte"],
  },
  {
    slug: "hyouka",
    title: "Hyouka",
    japaneseTitle: "Hyouka",
    synopsis:
      "Energy-saving high schooler Hotaro Oreki gets roped into his school's Classic Lit Club and solves small mysteries with Chitanda, Satoshi, and Mayaka. Low-stakes puzzles and gorgeous Kyoto Animation direction make every reveal a shared 'wait, rewind that clue' moment.",
    episodes: "22 episodes + OVA",
    genres: ["Mystery", "School", "Slice of Life"],
    related: ["classroom-of-the-elite", "steins-gate", "kaguya-sama"],
  },
  {
    slug: "march-comes-in-like-a-lion",
    title: "March Comes in Like a Lion",
    japaneseTitle: "3-gatsu no Lion",
    synopsis:
      "Teenage shogi prodigy Rei Kiriyama lives alone in Tokyo while wrestling grief, rivalry, and the found family of the Kawamoto sisters. Quiet shogi matches hit as hard as any fight scene when your group is invested in every breath between moves.",
    episodes: "44 episodes across 2 seasons",
    genres: ["Drama", "Slice of Life", "Sports"],
    related: ["violet-evergarden", "frieren-beyond-journeys-end", "toradora"],
  },
  {
    slug: "noragami",
    title: "Noragami",
    japaneseTitle: "Noragami",
    synopsis:
      "Stray god Yato takes five-yen jobs chasing lost spirits while ducking rival deities and patching his bond with weapon-spirit Yukine and mortal Hiyori. Snappy urban fantasy fights and banter-heavy downtime suit co-watchers who quote deity nicknames by episode three.",
    episodes: "25+ episodes across 2 seasons + OAD",
    genres: ["Action", "Supernatural", "Comedy"],
    related: ["bleach", "jujutsu-kaisen", "spy-x-family"],
  },
  {
    slug: "akame-ga-kill",
    title: "Akame ga Kill!",
    japaneseTitle: "Akame ga Kill!",
    synopsis:
      "Country boy Tatsumi joins assassins Night Raid against a corrupt empire—and learns heroism is messier than the pamphlets. Sudden turns and over-the-top Imperial Arms duels keep Discord threads loud when nobody agrees who's safe until the credits roll.",
    episodes: "24 episodes",
    genres: ["Action", "Fantasy", "Dark Fantasy"],
    related: ["demon-slayer", "chainsaw-man", "tokyo-ghoul"],
  },
  {
    slug: "kill-la-kill",
    title: "Kill la Kill",
    japaneseTitle: "Kill la Kill",
    synopsis:
      "Transfer student Ryuko Matoi storms Honnou Academy hunting her father's killer with a sentient sailor-uniform that feeds on embarrassment and rage. Visual maximalism and monologue pacing are built for group shout-alongs and frame-by-frame memes.",
    episodes: "24 episodes + OVA",
    genres: ["Action", "Comedy", "School"],
    related: ["gurren-lagann", "my-hero-academia", "jojos-bizarre-adventure"],
  },
  {
    slug: "angel-beats",
    title: "Angel Beats!",
    japaneseTitle: "Angel Beats!",
    synopsis:
      "Teens trapped in a surreal afterlife high school form the SSS to rebel against 'Angel'—then skirmishes keep colliding with concert interludes and sucker-punch backstories. Short enough to marathon in a weekend, emotional enough that someone always pretends they aren't tearing up.",
    episodes: "13 episodes + OVA",
    genres: ["Action", "Comedy", "Drama"],
    related: ["toradora", "oshi-no-ko", "spy-x-family"],
  },
  {
    slug: "fairy-tail",
    title: "Fairy Tail",
    japaneseTitle: "Fairy Tail",
    synopsis:
      "Celestial wizard Lucy joins the rowdy Fairy Tail guild alongside fire dragon slayer Natsu and a bench of mages who treat every job like a festival. Arc-based shonen comfort food—perfect for async rooms where half the crew yells guild catchphrases out of sync.",
    episodes: "328+ episodes across multiple seasons",
    genres: ["Action", "Adventure", "Fantasy"],
    related: ["one-piece", "naruto", "black-clover"],
  },
  {
    slug: "trigun",
    title: "Trigun",
    japaneseTitle: "Trigun",
    synopsis:
      "Gunman Vash the Stampede leaves insurance agents and bounty hunters scrambling across a desert planet while a goofy pacifist facade hides a heavier past. Episode-of-the-week western vibes with a late-series gut punch—your party will argue about dubs, donuts, and moral pacifism at once.",
    episodes: "26 episodes",
    genres: ["Action", "Sci-Fi", "Adventure"],
    related: ["cowboy-bebop", "samurai-champloo", "dorohedoro"],
  },
  {
    slug: "cyberpunk-edgerunners",
    title: "Cyberpunk: Edgerunners",
    japaneseTitle: "Cyberpunk: Edgerunners",
    synopsis:
      "Street kid David Martinez claws into Night City's chrome-soaked underworld after implant tech pushes him toward cyberpsychosis. Short, binge-perfect pacing lands brutal twists ideal for synchronized rewinds—and spoiler-heavy debates once credits roll.",
    episodes: "10 episodes",
    genres: ["Action", "Sci-Fi", "Thriller"],
    related: ["chainsaw-man", "neon-genesis-evangelion", "cowboy-bebop"],
  },
  {
    slug: "horimiya",
    title: "Horimiya",
    japaneseTitle: "Horimiya",
    synopsis:
      "Popular Izumi Miyamura and honors student Kyoko Hori collide outside school personas—and quietly rearrange each other's worlds in cozy vignettes. Low stakes on paper, huge serotonin payoff episode-to-episode for groups shipping slow-burn fluff.",
    episodes: "26 episodes (Season 1) + OVAs",
    genres: ["Romance", "Comedy", "School"],
    related: ["kaguya-sama", "toradora", "spy-x-family"],
  },
  {
    slug: "assassination-classroom",
    title: "Assassination Classroom",
    japaneseTitle: "Ansatsu Kyoshitsu",
    synopsis:
      "Earth-threatening octopus teacher Korosensei offers Class 3-E one shot at bounty-grade assassination mid-finals—all while genuinely leveling them up as students. Whiplash tone swings give chat endless meme fodder between morale arcs.",
    episodes: "47 episodes across 2 seasons",
    genres: ["Action", "Comedy", "School"],
    related: ["my-hero-academia", "mob-psycho-100", "spy-x-family"],
  },
  {
    slug: "beastars",
    title: "Beastars",
    japaneseTitle: "Beastars",
    synopsis:
      "Anthropomorphic carnivores and herbivores attend Cherryton Academy where instincts clash against etiquette—and suspicious murders fray dorm gossip. Stylish noir framing sparks discourse-heavy watch threads whenever morality arcs escalate.",
    episodes: "36 episodes across 2 seasons",
    genres: ["Drama", "Psychological", "School"],
    related: ["parasyte", "tokyo-ghoul", "chainsaw-man"],
  },
  {
    slug: "your-lie-in-april",
    title: "Your Lie in April",
    japaneseTitle: "Shigatsu wa Kimi no Uso",
    synopsis:
      "Prodigy pianist Kōsei Arima freezes until spirited violinist Kaori Miyazono drags him back toward stage lights and adolescent confession beats. Concert cliffhangers and tear ducts collide—prime territory for synchronized mute-unmute etiquette.",
    episodes: "22 episodes",
    genres: ["Drama", "Music", "Romance"],
    related: [
      "violet-evergarden",
      "march-comes-in-like-a-lion",
      "frieren-beyond-journeys-end",
    ],
  },
  {
    slug: "golden-kamuy",
    title: "Golden Kamuy",
    japaneseTitle: "Golden Kamuy",
    synopsis:
      "Russo-Japanese War vet Saichi Sugimoto teams with Ainu huntress Asirpa chasing tattooed convicts across Hokkaido's wilderness for buried gold. Survival tactics, culinary tangents, and gang warfare fuel marathon-length Discord debates.",
    episodes: "49 episodes across 4 seasons",
    genres: ["Action", "Adventure", "Historical"],
    related: ["vinland-saga", "dororo", "samurai-champloo"],
  },
  {
    slug: "great-pretender",
    title: "Great Pretender",
    japaneseTitle: "Great Pretender",
    synopsis:
      "Con artist Makoto Edamura stumbles into Laurent Thierry's globe-trotting crew mounting elaborate scams against worse villains. Candy-colored art direction hides vicious narrative rug-pulls—perfect when your room loves freeze-framing bait-and-switch reveals.",
    episodes: "23 episodes across multiple cours",
    genres: ["Action", "Adventure", "Mystery"],
    related: ["cowboy-bebop", "psycho-pass", "steins-gate"],
  },
  {
    slug: "zom-100-bucket-list-of-the-dead",
    title: "Zom 100: Bucket List of the Dead",
    japaneseTitle: "Zom 100: Zombie ni Naru Made ni Shitai 100 no Koto",
    synopsis:
      "Office burnout Akira rediscovers joy after zombies overrun Tokyo—by ticking off a ludicrous bucket list between sprinting undead set pieces. Bright palette vs body horror keeps adrenaline comedy spikes flowing through async reaction stacks.",
    episodes: "12 episodes (Season 1)",
    genres: ["Action", "Comedy", "Horror"],
    related: ["chainsaw-man", "konosuba", "solo-leveling"],
  },
  {
    slug: "delicious-in-dungeon",
    title: "Delicious in Dungeon",
    japaneseTitle: "Dungeon Meshi",
    synopsis:
      "When an adventuring party runs out of supplies deep in a dungeon, their pragmatic fighter turns monsters into gourmet meals. RPG logistics meet cozy cooking comedy—ideal for groups that want shared gasps, recipe banter, and debate over whether you would eat that boss drop.",
    episodes: "24+ episodes (TV)",
    genres: ["Adventure", "Comedy", "Fantasy"],
    related: ["made-in-abyss", "konosuba", "that-time-i-got-reincarnated-as-a-slime"],
  },
  {
    slug: "darling-in-the-franxx",
    title: "Darling in the Franxx",
    japaneseTitle: "Darling in the Franxx",
    synopsis:
      "Children pilot biomechanical Franxx mechs from Plantation fortresses while grappling identity erasure and volatile partnerships zero-two famous enough to meme on sight. Melodrama plus kaiju brawls guarantee rotating Hot Takes every reunion.",
    episodes: "24 episodes",
    genres: ["Action", "Mecha", "Romance"],
    related: ["neon-genesis-evangelion", "gurren-lagann", "code-geass"],
  },
  {
    slug: "the-disastrous-life-of-saiki-k",
    title: "The Disastrous Life of Saiki K.",
    japaneseTitle: "Saiki Kusuo no Psi Nan",
    synopsis:
      "Psychic high schooler Saiki Kusuo wants solitude yet classmates chaotic enough to weaponize telepathy keep sabotaging him. Five-minute gag bursts reward distracted rooms catching jokes asynchronous-style between pings.",
    episodes: "120 short-format episodes across multiple seasons",
    genres: ["Comedy", "School", "Supernatural"],
    related: ["kaguya-sama", "konosuba", "mob-psycho-100"],
  },
  {
    slug: "odd-taxi",
    title: "ODDTAXI",
    japaneseTitle: "Odd Taxi",
    synopsis:
      "Walled-off taxi driver Odokawa seems ordinary until small conversations connect to missing girls, yakuza money, and a widening web of secrets. Every episode drops a new clue that your watchroom will want to pause and piece together.",
    episodes: "13 episodes",
    genres: ["Mystery", "Thriller", "Drama"],
    related: ["erased", "monster", "great-pretender"],
  },
  {
    slug: "k-on",
    title: "K-On!",
    japaneseTitle: "K-On!",
    synopsis:
      "A group of high school girls form a light music club, turning practice into equal parts jam sessions, snacks, and friendship rituals. It’s cozy, funny, and easy to watch in short bursts — perfect for low-stress group nights.",
    episodes: "41 episodes across 2 seasons + movie",
    genres: ["Comedy", "Music", "Slice of Life"],
    related: ["bocchi-the-rock", "your-lie-in-april", "horimiya"],
  },
  {
    slug: "a-silent-voice",
    title: "A Silent Voice",
    japaneseTitle: "Koe no Katachi",
    synopsis:
      "A former bully tries to make amends with a deaf girl he hurt in elementary school, but guilt and anxiety make every step messy. It’s a powerful single-sitting watch that sparks real conversations after the credits.",
    episodes: "Movie",
    genres: ["Drama", "Romance", "Slice of Life"],
    related: ["violet-evergarden", "your-lie-in-april", "toradora"],
  },
  {
    slug: "your-name",
    title: "Your Name.",
    japaneseTitle: "Kimi no Na wa.",
    synopsis:
      "Two teens begin swapping bodies across distance and time, building a bond through notes, habits, and shared confusion. When the mystery deepens, the movie becomes a twisty, emotional sprint that’s great to react to together.",
    episodes: "Movie",
    genres: ["Romance", "Drama", "Supernatural"],
    related: ["a-silent-voice", "your-lie-in-april", "toradora"],
  },
  {
    slug: "slam-dunk",
    title: "Slam Dunk",
    japaneseTitle: "Slam Dunk",
    synopsis:
      "Delinquent Hanamichi Sakuragi joins the Shohoku basketball team for a crush — then finds a competitive obsession he didn’t know he had. Classic training arcs, rival matchups, and momentum swings make it ideal for long, hype marathons.",
    episodes: "101 episodes",
    genres: ["Sports", "Comedy", "Drama"],
    related: ["haikyuu", "blue-lock", "march-comes-in-like-a-lion"],
  },
];
