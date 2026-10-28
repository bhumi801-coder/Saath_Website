// Built-in knowledge base for the Saath assistant. It answers in Hindi (Devanagari), English or
// Hinglish (Hindi in English letters), matching the user's message. It is used when no
// ANTHROPIC_API_KEY is set, or as a safety net if the AI call fails.
//
// To add a topic: add an object to TOPICS with `all` (every group needs one keyword hit), an optional
// `service` slug (shows a "Book" button) and replies in en / hi / hing.

const norm = (s) => String(s || '').toLowerCase().normalize('NFC');
export const tokenize = (s) => norm(s).replace(/\ba\.\s?c\b/g, 'ac').split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);

// ---- language detection -------------------------------------------------------
const HING = new Set(['namaste', 'namaskar', 'hai', 'hain', 'hei', 'kya', 'nahi', 'nhi', 'mera', 'meri', 'mere', 'mujhe', 'mujhko', 'kaise', 'kese', 'kyun', 'kyu', 'kyon',
  'rha', 'rhi', 'rhe', 'raha', 'rahi', 'rahe', 'paani', 'pani', 'chahiye', 'chahie', 'batao', 'bata', 'bataiye', 'karo', 'kare', 'karna', 'krna', 'kr', 'kar',
  'hoga', 'hogi', 'aap', 'apka', 'aapka', 'tapak', 'tapk', 'tok', 'thanda', 'gadi', 'gaadi', 'ghar', 'safai', 'kitna', 'kitne', 'kab', 'abhi', 'wala', 'wali',
  'h', 'se', 'mein', 'liye', 'lie', 'bahut', 'bhot', 'ho', 'gaya', 'gya', 'gayi', 'ki', 'ka', 'ko', 'par', 'pe', 'aur', 'ya', 'theek', 'thik', 'nikal', 'aa', 'aata',
  'aati', 'aarha', 'arha', 'band', 'chalu', 'sahi', 'karwana', 'karvana', 'bulao', 'madad', 'dikkat', 'samasya', 'kaam', 'paise', 'rupaye', 'kitni']);
const AMBIGUOUS = new Set(['ho', 'ka', 'ki', 'ko', 'se', 'par', 'pe', 'aa', 'ya', 'kar', 'aur', 'tok', 'mein']); // also common in English / names
export function detectLang(text, previous = 'en') {
  const s = String(text || '');
  const dev = (s.match(/[\u0900-\u097F]/g) || []).length;
  const letters = (s.match(/\p{L}/gu) || []).length || 1;
  if (dev / letters > 0.25) return 'hi';
  const toks = tokenize(s);
  const strong = toks.filter((t) => HING.has(t) && !AMBIGUOUS.has(t)).length;
  const weak = toks.filter((t) => AMBIGUOUS.has(t)).length;
  if (strong >= 1 || weak >= 3) return 'hing';
  if (toks.length <= 2 && previous) return previous;   // "ok", "thanks": stay in the same language
  return 'en';
}

// ---- keyword groups -----------------------------------------------------------
const G = {
  ac: ['ac', 'a.c', 'aircon', 'aircondition', 'conditioner', 'split', 'एसी', 'ए', 'सी', 'एयर', 'कंडीशनर', 'cooler'],
  leak: ['leak', 'leaks', 'leaking', 'drip', 'dripping', 'dripped', 'water', 'paani', 'pani', 'tapak', 'tapk', 'tak', 'tok', 'tipak', 'tapakna', 'tapakne', 'rishna', 'risna',
    'पानी', 'टपक', 'टपकना', 'टपकने', 'लीक', 'रिस', 'बह', 'गिर'],
  cooling: ['cooling', 'cool', 'thanda', 'thandi', 'thandak', 'garam', 'hot', 'warm', 'ठंडा', 'ठंडक', 'गर्म', 'कूलिंग', 'हवा', 'hawa'],
  smell: ['smell', 'smells', 'odour', 'odor', 'stink', 'stinks', 'badbu', 'bdbu', 'बदबू', 'गंध', 'महक'],
  noise: ['noise', 'noisy', 'sound', 'loud', 'rattle', 'awaaz', 'awaz', 'shor', 'khatkhat', 'आवाज', 'शोर', 'खटखट'],
  ice: ['ice', 'frost', 'frozen', 'freeze', 'barf', 'jam', 'जम', 'बर्फ'],
  notOn: ['start', 'starts', 'on', 'remote', 'power', 'dead', 'chalu', 'chal', 'chalta', 'band', 'shuru', 'display', 'चालू', 'चल', 'बंद', 'रिमोट', 'शुरू'],
  bill: ['bill', 'electricity', 'bijli', 'units', 'बिल', 'बिजली'],
  car: ['car', 'cars', 'gadi', 'gaadi', 'vehicle', 'suv', 'कार', 'गाड़ी', 'गाडी'],
  wash: ['wash', 'washing', 'dhona', 'dhulai', 'dhulwana', 'shine', 'polish', 'धुलाई', 'धोना', 'वॉश', 'धुल'],
  purifier: ['ro', 'purifier', 'aquaguard', 'kent', 'tds', 'प्यूरीफायर', 'आरओ', 'फिल्टर', 'filter'],
  taste: ['taste', 'tastes', 'smell', 'salty', 'bitter', 'swad', 'namkeen', 'kadwa', 'badbu', 'स्वाद', 'नमकीन', 'कड़वा', 'बदबू'],
  slow: ['slow', 'low', 'flow', 'dheere', 'dhire', 'kam', 'nahi', 'nhi', 'aa', 'aata', 'aati', 'no', 'stopped', 'band', 'धीरे', 'कम', 'नहीं', 'बंद'],
  filterChange: ['change', 'replace', 'replacement', 'membrane', 'cartridge', 'badalna', 'badlana', 'बदल', 'बदलना'],
  sofa: ['sofa', 'sofas', 'carpet', 'rug', 'mattress', 'gadda', 'upholstery', 'सोफा', 'सोफे', 'सोफ़ा', 'कालीन', 'कारपेट', 'गद्दा', 'गद्दे'],
  stain: ['stain', 'stains', 'daag', 'dag', 'dirty', 'spill', 'coffee', 'tea', 'chai', 'दाग', 'गंदा', 'चाय', 'कॉफी'],
  allergy: ['allergy', 'allergic', 'dust', 'sneeze', 'mites', 'dhool', 'mitti', 'एलर्जी', 'धूल', 'छींक'],
  clean: ['clean', 'cleaning', 'deep', 'safai', 'saaf', 'sanitise', 'sanitize', 'mop', 'kitchen', 'bathroom', 'सफाई', 'साफ', 'किचन', 'बाथरूम'],
  home: ['home', 'house', 'flat', 'ghar', 'apartment', 'घर', 'फ्लैट'],
  pest: ['pest', 'cockroach', 'cockroaches', 'roach', 'ant', 'ants', 'termite', 'termites', 'deemak', 'keeda', 'keede', 'kide', 'kida', 'chuha', 'rat', 'mosquito', 'machhar', 'bedbug', 'bedbugs', 'lizard', 'chhipkali', 'bugs', 'insects',
    'तिलचट्टा', 'कॉकरोच', 'कीड़े', 'कीड़ा', 'दीमक', 'चूहा', 'मच्छर', 'चींटी', 'चीटी', 'छिपकली', 'खटमल'],
  safeKids: ['safe', 'kids', 'children', 'child', 'baby', 'pets', 'pet', 'dog', 'cat', 'bachche', 'bacche', 'bachon', 'surakshit', 'सुरक्षित', 'बच्चे', 'बच्चों', 'पालतू'],
  price: ['price', 'prices', 'cost', 'charge', 'charges', 'rate', 'rates', 'fees', 'kitna', 'kitne', 'kitni', 'kharcha', 'kharch', 'खर्च', 'खर्चा', 'cost', 'paise', 'rupaye', 'rupees', 'daam', 'keemat', 'कीमत', 'दाम', 'कितना', 'कितने', 'कितनी', 'रेट', 'चार्ज', 'पैसे', 'रुपये'],
  book: ['book', 'booking', 'schedule', 'appointment', 'karwana', 'karvana', 'bulao', 'bulana', 'order', 'बुक', 'बुकिंग', 'करवाना', 'बुलाना'],
  how: ['works', 'work', 'process', 'steps', 'kaam', 'group', 'unlock', 'ग्रुप', 'काम', 'समझाओ', 'explain'],
  pay: ['pay', 'payment', 'paid', 'upi', 'card', 'razorpay', 'netbanking', 'cash', 'bhugtan', 'paymnt', 'पेमेंट', 'भुगतान', 'यूपीआई', 'कैश'],
  refund: ['refund', 'cancel', 'cancelled', 'cancellation', 'wapas', 'vapas', 'रिफंड', 'कैंसल', 'वापस', 'रद्द'],
  slot: ['slot', 'time', 'timing', 'timings', 'when', 'kab', 'samay', 'waqt', 'arrive', 'arrival', 'date', 'schedule', 'स्लॉट', 'समय', 'कब', 'तारीख'],
  society: ['society', 'societies', 'colony', 'apartment', 'sector', 'listed', 'missing', 'add', 'सोसाइटी', 'कॉलोनी'],
  login: ['login', 'log', 'password', 'forgot', 'reset', 'otp', 'signup', 'sign', 'account', 'भूल', 'पासवर्ड', 'लॉगिन', 'अकाउंट'],
  human: ['human', 'agent', 'support', 'contact', 'call', 'phone', 'email', 'helpline', 'complaint', 'sampark', 'number', 'सहायता', 'संपर्क', 'शिकायत', 'कॉल'],
  hello: ['hi', 'hello', 'hey', 'hii', 'hiii', 'namaste', 'namaskar', 'helo', 'good', 'morning', 'evening', 'नमस्ते', 'नमस्कार', 'हेलो', 'हाय'],
  thanks: ['thanks', 'thank', 'thankyou', 'thx', 'shukriya', 'dhanyawad', 'dhanyavaad', 'ok', 'okay', 'theek', 'धन्यवाद', 'शुक्रिया', 'थैंक्स'],
  danger: ['gas', 'sparking', 'spark', 'sparks', 'fire', 'smoke', 'burning', 'shock', 'shocks', 'current', 'aag', 'dhuan', 'chingari', 'jalne', 'jalta', 'करंट', 'आग', 'धुआं', 'धुआँ', 'चिंगारी', 'शॉक'],
  services: ['service', 'services', 'sevayen', 'sewa', 'what', 'kya', 'kaunsi', 'kaun', 'offer', 'सेवा', 'सेवाएं', 'क्या'],
};

function hit(tokens, words, text) {
  let n = 0;
  for (const w of words) {
    if (w.length <= 3) { if (tokens.includes(w)) n++; }
    else if (tokens.some((t) => t === w || (t.length >= w.length && t.startsWith(w)))) n++;
    else if (w.includes(' ') && text.includes(w)) n++;
  }
  return n;
}

// ---- topics -------------------------------------------------------------------
const BOOK_LINE = {
  en: 'If it is not fixed, you can book a technician here and share the cost with your neighbours.',
  hi: 'अगर समस्या ठीक न हो तो नीचे दिए बटन से टेक्नीशियन बुक करें और पड़ोसियों के साथ खर्च बाँटें।',
  hing: 'Agar problem theek na ho to neeche diye button se technician book karein aur padosiyon ke saath kharcha baantein.',
};

export const TOPICS = [
  {
    id: 'ac-leak', service: 'ac-repair', all: [G.ac, G.leak], weight: 3,
    en: `Water dripping from an AC is usually one of these:\n1. Clogged drain pipe: the most common cause. A technician can flush it.\n2. Dirty filter or coil: take out the filter, rinse it with plain water, dry it and put it back.\n3. Ice melting: a frozen coil (poor airflow or low gas) drips water when it thaws.\n4. The indoor unit is not level: it should tilt slightly towards the drain side.\n\nSwitch the AC off for a few hours, keep a towel under the unit, and do not open the outdoor unit yourself. ${BOOK_LINE.en}`,
    hi: `AC से पानी टपकने के आमतौर पर ये कारण होते हैं:\n1. ड्रेन पाइप जाम: सबसे आम कारण। टेक्नीशियन इसे साफ कर देता है।\n2. फिल्टर या कॉइल गंदा: फिल्टर निकालकर सादे पानी से धोएँ, सुखाएँ और वापस लगा दें।\n3. बर्फ पिघलना: कॉइल जम जाए (हवा कम या गैस कम) तो पिघलने पर पानी टपकता है।\n4. इनडोर यूनिट सीधी न लगी हो: उसका झुकाव ड्रेन की तरफ थोड़ा होना चाहिए।\n\nAC को कुछ घंटे बंद रखें, नीचे तौलिया रख दें और आउटडोर यूनिट खुद न खोलें। ${BOOK_LINE.hi}`,
    hing: `AC se paani tapakne ke aam taur par ye kaaran hote hain:\n1. Drain pipe jaam: sabse common wajah. Technician use saaf kar deta hai.\n2. Filter ya coil gandi: filter nikaal kar saade paani se dhoyein, sukha kar wapas laga dein.\n3. Barf pighalna: coil jam jaye (hawa kam ya gas kam) to pighalne par paani tapakta hai.\n4. Indoor unit seedhi nahi lagi: uska jhukaav drain ki taraf thoda hona chahiye.\n\nAC ko kuch ghante band rakhein, neeche tauliya rakh dein aur outdoor unit khud na kholein. ${BOOK_LINE.hing}`,
  },
  {
    id: 'ac-cooling', service: 'ac-repair', all: [G.ac, G.cooling], weight: 3,
    en: `If your AC is not cooling properly, try this first:\n1. Clean the filter (rinse and dry it). A choked filter is the number one cause.\n2. Set it to Cool mode, 24 to 26°C, fan on Auto, and keep doors and windows shut.\n3. Check that the outdoor unit fan is spinning and nothing is blocking it.\n\nIf it still blows warm or weak air, the gas may be low or the coil dirty, and that needs a technician. ${BOOK_LINE.en}`,
    hi: `अगर AC ठीक से ठंडा नहीं कर रहा तो पहले ये करें:\n1. फिल्टर साफ करें (धोकर सुखाएँ)। जाम फिल्टर सबसे बड़ा कारण है।\n2. Cool मोड, 24 से 26°C और फैन Auto पर रखें, दरवाज़े-खिड़कियाँ बंद रखें।\n3. देखें कि आउटडोर यूनिट का पंखा घूम रहा है और कुछ रुकावट नहीं है।\n\nफिर भी गर्म या कमज़ोर हवा आए तो गैस कम या कॉइल गंदी हो सकती है, इसके लिए टेक्नीशियन चाहिए। ${BOOK_LINE.hi}`,
    hing: `Agar AC theek se thanda nahi kar raha to pehle ye karein:\n1. Filter saaf karein (dhokar sukhayein). Jaam filter sabse bada kaaran hai.\n2. Cool mode, 24 se 26°C aur fan Auto par rakhein, darwaze-khidkiyan band rakhein.\n3. Dekhein ki outdoor unit ka pankha ghoom raha hai aur kuch rukawat nahi hai.\n\nPhir bhi garam ya kamzor hawa aaye to gas kam ya coil gandi ho sakti hai, uske liye technician chahiye. ${BOOK_LINE.hing}`,
  },
  {
    id: 'ac-smell', service: 'ac-repair', all: [G.ac, G.smell], weight: 3,
    en: `A bad smell from the AC usually means dirty filters or damp coils growing mould.\n1. Switch off, remove the filter and wash it with mild soap and water. Dry fully.\n2. Run the AC in Fan mode for 20 to 30 minutes so the inside dries.\n\nIf the smell stays, the coil and drain tray need a jet-wash service. ${BOOK_LINE.en}`,
    hi: `AC से बदबू आने का मतलब आमतौर पर गंदा फिल्टर या नम कॉइल में फफूंद है।\n1. AC बंद करें, फिल्टर निकालकर हल्के साबुन और पानी से धोएँ और अच्छी तरह सुखाएँ।\n2. AC को 20 से 30 मिनट Fan मोड पर चलाएँ ताकि अंदर सूख जाए।\n\nबदबू फिर भी रहे तो कॉइल और ड्रेन ट्रे की जेट-वॉश सर्विस करानी होगी। ${BOOK_LINE.hi}`,
    hing: `AC se badbu aane ka matlab aam taur par ganda filter ya nam coil mein fungus hota hai.\n1. AC band karein, filter nikaal kar halke saabun aur paani se dhoyein aur achhe se sukhayein.\n2. AC ko 20 se 30 minute Fan mode par chalayein taaki andar sookh jaye.\n\nBadbu phir bhi rahe to coil aur drain tray ki jet-wash service karwani hogi. ${BOOK_LINE.hing}`,
  },
  {
    id: 'ac-noise', service: 'ac-repair', all: [G.ac, G.noise], weight: 3,
    en: `AC noise usually comes from a loose panel, a dirty fan, or a worn motor or fan blade.\n1. Switch off and check that the front panel and filter are seated properly.\n2. Look for anything touching the outdoor unit (leaves, loose screws, a bent cover).\n\nGrinding or loud banging means a part is failing. Stop using the AC until it is checked. ${BOOK_LINE.en}`,
    hi: `AC की आवाज़ आमतौर पर ढीले पैनल, गंदे पंखे या घिसी हुई मोटर/ब्लेड से आती है।\n1. AC बंद करके देखें कि फ्रंट पैनल और फिल्टर ठीक से लगे हैं।\n2. आउटडोर यूनिट को कुछ छू तो नहीं रहा (पत्ते, ढीले स्क्रू, मुड़ा कवर)।\n\nघिसने या जोर से ठोकने की आवाज़ का मतलब पुर्ज़ा खराब हो रहा है। जाँच होने तक AC न चलाएँ। ${BOOK_LINE.hi}`,
    hing: `AC ki awaaz aam taur par dheele panel, gande pankhe ya ghisi hui motor/blade se aati hai.\n1. AC band karke dekhein ki front panel aur filter theek se lage hain.\n2. Outdoor unit ko kuch chhu to nahi raha (patte, dheele screw, muda cover).\n\nGhisne ya zor se thokne ki awaaz ka matlab purza kharab ho raha hai. Jaanch hone tak AC na chalayein. ${BOOK_LINE.hing}`,
  },
  {
    id: 'ac-ice', service: 'ac-repair', all: [G.ac, G.ice], weight: 3,
    en: `Ice on the AC coil or pipe means poor airflow or low gas.\n1. Turn the AC off and run only the fan for an hour so the ice melts. Put a towel below.\n2. Clean the filter before using it again.\n\nIf ice forms again, the gas is likely leaking and needs a technician. ${BOOK_LINE.en}`,
    hi: `AC की कॉइल या पाइप पर बर्फ जमने का मतलब हवा का बहाव कम या गैस कम है।\n1. AC बंद करके सिर्फ फैन एक घंटा चलाएँ ताकि बर्फ पिघल जाए। नीचे तौलिया रखें।\n2. दोबारा चलाने से पहले फिल्टर साफ करें।\n\nबर्फ फिर जमे तो गैस लीक होने की संभावना है, टेक्नीशियन चाहिए। ${BOOK_LINE.hi}`,
    hing: `AC ki coil ya pipe par barf jamne ka matlab hawa ka bahaav kam ya gas kam hai.\n1. AC band karke sirf fan ek ghanta chalayein taaki barf pighal jaye. Neeche tauliya rakhein.\n2. Dobara chalane se pehle filter saaf karein.\n\nBarf phir jame to gas leak hone ki sambhavna hai, technician chahiye. ${BOOK_LINE.hing}`,
  },
  {
    id: 'ac-wont-start', service: 'ac-repair', all: [G.ac, G.notOn], weight: 2,
    en: `If the AC will not turn on:\n1. Check the remote batteries and try the button on the unit itself.\n2. Check the MCB or switch for the AC in your fuse box, and that the plug socket has power.\n3. Wait 3 minutes and try again, since many ACs have a delay after switching off.\n\nIf it still does not start, a technician should check the board or capacitor. ${BOOK_LINE.en}`,
    hi: `अगर AC चालू नहीं हो रहा:\n1. रिमोट की बैटरी देखें और यूनिट का अपना बटन दबाकर देखें।\n2. फ्यूज़ बॉक्स में AC का MCB या स्विच और सॉकेट में बिजली जाँचें।\n3. 3 मिनट रुककर फिर कोशिश करें, कई AC बंद होने के बाद कुछ देर रुकते हैं।\n\nफिर भी न चले तो बोर्ड या कैपेसिटर की जाँच टेक्नीशियन से करवाएँ। ${BOOK_LINE.hi}`,
    hing: `Agar AC chalu nahi ho raha:\n1. Remote ki battery dekhein aur unit ka apna button dabakar dekhein.\n2. Fuse box mein AC ka MCB ya switch aur socket mein bijli check karein.\n3. 3 minute ruk kar phir koshish karein, kai AC band hone ke baad kuch der rukte hain.\n\nPhir bhi na chale to board ya capacitor ki jaanch technician se karwayein. ${BOOK_LINE.hing}`,
  },
  {
    id: 'ac-bill', service: 'ac-repair', all: [G.ac, G.bill], weight: 2,
    en: `To cut AC electricity use: keep it at 24 to 26°C, clean the filter every 2 to 3 weeks, close doors and windows, and get a service once or twice a year. A dirty coil or low gas makes the compressor work harder and raises the bill. ${BOOK_LINE.en}`,
    hi: `AC का बिजली बिल घटाने के लिए: 24 से 26°C पर चलाएँ, हर 2 से 3 हफ्ते में फिल्टर साफ करें, दरवाज़े-खिड़कियाँ बंद रखें और साल में एक-दो बार सर्विस कराएँ। गंदी कॉइल या कम गैस से कंप्रेसर ज़्यादा मेहनत करता है और बिल बढ़ता है। ${BOOK_LINE.hi}`,
    hing: `AC ka bijli bill kam karne ke liye: 24 se 26°C par chalayein, har 2 se 3 hafte mein filter saaf karein, darwaze-khidkiyan band rakhein aur saal mein ek-do baar service karwayein. Gandi coil ya kam gas se compressor zyada mehnat karta hai aur bill badhta hai. ${BOOK_LINE.hing}`,
  },
  {
    id: 'purifier-taste', service: 'water-purifier', all: [G.purifier, G.taste], weight: 3,
    en: `Bad taste or smell in purified water usually means the filters or membrane are due for a change, or the tank needs sanitising.\n1. Drain the tank and run a few litres through.\n2. Check when the filters were last changed. Most need changing every 6 to 12 months.\n\nA service with a TDS test will tell if the membrane has to be replaced. ${BOOK_LINE.en}`,
    hi: `प्यूरीफाइड पानी में स्वाद या बदबू का मतलब अक्सर फिल्टर/मेम्ब्रेन बदलने का समय है या टैंक की सफाई चाहिए।\n1. टैंक खाली करके कुछ लीटर पानी निकाल दें।\n2. देखें कि फिल्टर आखिरी बार कब बदले थे। ज़्यादातर 6 से 12 महीने में बदलने होते हैं।\n\nTDS टेस्ट के साथ सर्विस से पता चलेगा कि मेम्ब्रेन बदलनी है या नहीं। ${BOOK_LINE.hi}`,
    hing: `Purified paani mein swaad ya badbu ka matlab aksar filter/membrane badalne ka samay hai ya tank ki safai chahiye.\n1. Tank khaali karke kuch litre paani nikaal dein.\n2. Dekhein ki filter aakhri baar kab badle the. Zyadatar 6 se 12 mahine mein badalne hote hain.\n\nTDS test ke saath service se pata chalega ki membrane badalni hai ya nahi. ${BOOK_LINE.hing}`,
  },
  {
    id: 'purifier-slow', service: 'water-purifier', all: [G.purifier, G.slow], weight: 2,
    en: `If the purifier gives very little water or stops:\n1. Check the tap water supply and that the inlet valve is open.\n2. Make sure the power adapter is on and the tank is not already full.\n3. A choked pre-filter or sediment filter is the usual reason for a slow flow.\n\nIf it still trickles, the filters or membrane need servicing. ${BOOK_LINE.en}`,
    hi: `अगर प्यूरीफायर बहुत कम पानी दे रहा है या बंद हो गया:\n1. नल का पानी आ रहा है और इनलेट वाल्व खुला है, यह देखें।\n2. पावर अडैप्टर चालू है और टैंक पहले से भरा नहीं है, यह जाँचें।\n3. प्री-फिल्टर या सेडिमेंट फिल्टर जाम होना धीमे बहाव का आम कारण है।\n\nफिर भी बूँद-बूँद आए तो फिल्टर या मेम्ब्रेन की सर्विस चाहिए। ${BOOK_LINE.hi}`,
    hing: `Agar purifier bahut kam paani de raha hai ya band ho gaya:\n1. Nal ka paani aa raha hai aur inlet valve khula hai, ye dekhein.\n2. Power adapter chalu hai aur tank pehle se bhara nahi hai, ye check karein.\n3. Pre-filter ya sediment filter jaam hona dheeme bahaav ka aam kaaran hai.\n\nPhir bhi boond-boond aaye to filter ya membrane ki service chahiye. ${BOOK_LINE.hing}`,
  },
  {
    id: 'purifier-service', service: 'water-purifier', all: [G.purifier], weight: 1,
    en: `Our water purifier service covers a filter and membrane check, tank sanitisation, a TDS test and a service warranty. It works for RO and UV purifiers of any brand. Filters are billed separately only if they need replacing. ${BOOK_LINE.en}`,
    hi: `हमारी वाटर प्यूरीफायर सर्विस में फिल्टर और मेम्ब्रेन की जाँच, टैंक सैनिटाइज़, TDS टेस्ट और सर्विस वारंटी शामिल है। यह किसी भी ब्रांड के RO और UV प्यूरीफायर पर चलती है। फिल्टर बदलना पड़े तभी उसका अलग बिल बनता है। ${BOOK_LINE.hi}`,
    hing: `Hamari water purifier service mein filter aur membrane ki jaanch, tank sanitisation, TDS test aur service warranty shamil hai. Ye kisi bhi brand ke RO aur UV purifier par chalti hai. Filter badalna pade tabhi uska alag bill banta hai. ${BOOK_LINE.hing}`,
  },
  {
    id: 'sofa-stain', service: 'sofa-cleaning', all: [G.sofa, G.stain], weight: 3,
    en: `For a fresh stain: blot (do not rub) with a clean cloth, then dab with a little mild soap and cold water. Avoid hot water and bleach, they set the stain and fade the fabric. Test on a hidden corner first.\n\nOld or large stains, and deep dirt, come out best with dry-vacuum plus shampoo extraction. ${BOOK_LINE.en}`,
    hi: `ताज़े दाग के लिए: साफ कपड़े से दबाकर सोखें (रगड़ें नहीं), फिर हल्के साबुन और ठंडे पानी से थपथपाएँ। गर्म पानी और ब्लीच से बचें, इनसे दाग पक्का होता है और रंग उड़ता है। पहले किसी छिपे कोने पर आज़माएँ।\n\nपुराने या बड़े दाग और गहरी गंदगी के लिए ड्राई-वैक्यूम और शैम्पू एक्सट्रैक्शन सबसे अच्छा है। ${BOOK_LINE.hi}`,
    hing: `Taaze daag ke liye: saaf kapde se dabakar sokhein (ragdein nahi), phir halke saabun aur thande paani se thapthapayein. Garam paani aur bleach se bachein, inse daag pakka hota hai aur rang udta hai. Pehle kisi chhupe kone par aazmayein.\n\nPurane ya bade daag aur gehri ganda dry-vacuum aur shampoo extraction se sabse achhi nikalti hai. ${BOOK_LINE.hing}`,
  },
  {
    id: 'sofa-allergy', service: 'sofa-cleaning', all: [G.sofa, G.allergy, G.smell], any: true, weight: 2,
    en: `Dust, mites and smell build up deep inside sofas, carpets and mattresses. Vacuum weekly, air them in the sun now and then, and get a deep clean every 6 to 12 months. Dry-vacuum plus shampoo extraction removes dust and odour, and it dries in about 3 to 4 hours. ${BOOK_LINE.en}`,
    hi: `सोफा, कालीन और गद्दे के अंदर धूल, माइट्स और बदबू जम जाती है। हफ्ते में एक बार वैक्यूम करें, कभी-कभी धूप में रखें और हर 6 से 12 महीने में डीप क्लीन कराएँ। ड्राई-वैक्यूम और शैम्पू एक्सट्रैक्शन से धूल और बदबू निकलती है और लगभग 3 से 4 घंटे में सूख जाता है। ${BOOK_LINE.hi}`,
    hing: `Sofa, carpet aur gadde ke andar dhool, mites aur badbu jam jaati hai. Hafte mein ek baar vacuum karein, kabhi-kabhi dhoop mein rakhein aur har 6 se 12 mahine mein deep clean karwayein. Dry-vacuum aur shampoo extraction se dhool aur badbu nikalti hai aur lagbhag 3 se 4 ghante mein sookh jaata hai. ${BOOK_LINE.hing}`,
  },
  {
    id: 'sofa-service', service: 'sofa-cleaning', all: [G.sofa], weight: 1,
    en: `Our sofa and carpet cleaning includes dry vacuum, shampoo extraction and stain treatment, and it dries in 3 to 4 hours. ${BOOK_LINE.en}`,
    hi: `हमारी सोफा और कालीन सफाई में ड्राई वैक्यूम, शैम्पू एक्सट्रैक्शन और दाग का इलाज शामिल है, और यह 3 से 4 घंटे में सूख जाता है। ${BOOK_LINE.hi}`,
    hing: `Hamari sofa aur carpet safai mein dry vacuum, shampoo extraction aur daag ka ilaaj shamil hai, aur ye 3 se 4 ghante mein sookh jaata hai. ${BOOK_LINE.hing}`,
  },
  {
    id: 'pest-safe', service: 'pest-control', all: [G.pest, G.safeKids], weight: 3,
    en: `Our pest treatment is odourless gel and spray, designed to be safe for kids and pets. Keep children and pets out of the treated area for about 2 hours, cover food and utensils, and you can be back in the flat after that. It comes with a service warranty. ${BOOK_LINE.en}`,
    hi: `हमारा पेस्ट ट्रीटमेंट बिना गंध वाला जेल और स्प्रे है, जो बच्चों और पालतू जानवरों के लिए सुरक्षित बनाया गया है। लगभग 2 घंटे तक बच्चों और पालतू जानवरों को उस हिस्से से दूर रखें, खाना और बर्तन ढक दें, उसके बाद आप फ्लैट में लौट सकते हैं। इस पर सर्विस वारंटी मिलती है। ${BOOK_LINE.hi}`,
    hing: `Hamara pest treatment bina gandh wala gel aur spray hai, jo bachchon aur pet ke liye surakshit banaya gaya hai. Lagbhag 2 ghante tak bachchon aur pets ko us hisse se door rakhein, khana aur bartan dhak dein, uske baad aap flat mein laut sakte hain. Is par service warranty milti hai. ${BOOK_LINE.hing}`,
  },
  {
    id: 'pest-problem', service: 'pest-control', all: [G.pest], weight: 2,
    en: `Quick steps while you wait for treatment: keep food sealed, wipe kitchen counters at night, fix leaking taps (pests need water), take out garbage daily, and seal gaps around pipes and skirting. Cockroaches and ants are best controlled with a gel and spray treatment in the kitchen, bathrooms and balcony. ${BOOK_LINE.en}`,
    hi: `ट्रीटमेंट तक ये करें: खाना बंद रखें, रात को किचन की स्लैब पोंछें, टपकते नल ठीक करें (कीड़ों को पानी चाहिए), रोज़ कचरा बाहर रखें और पाइप व स्कर्टिंग के आसपास की दरारें बंद करें। तिलचट्टे और चींटियों के लिए किचन, बाथरूम और बालकनी में जेल और स्प्रे ट्रीटमेंट सबसे असरदार है। ${BOOK_LINE.hi}`,
    hing: `Treatment tak ye karein: khana band rakhein, raat ko kitchen ki slab ponchhein, tapakte nal theek karein (keedon ko paani chahiye), roz kachra bahar rakhein aur pipe va skirting ke aaspaas ki daraarein band karein. Cockroach aur cheentiyon ke liye kitchen, bathroom aur balcony mein gel aur spray treatment sabse asardaar hai. ${BOOK_LINE.hing}`,
  },
  {
    id: 'car-wash', service: 'car-wash', all: [G.car], weight: 1,
    en: `Our car wash is a foam exterior wash with interior vacuum and tyre and dashboard polish, done in your parking bay with a water-saving method. Tell the team your parking bay in the note when you join, and leave the car unlocked with the key at the gate if the host says so. ${BOOK_LINE.en}`,
    hi: `हमारी कार वॉश में फोम एक्सटीरियर वॉश, इंटीरियर वैक्यूम और टायर व डैशबोर्ड पॉलिश शामिल है, और यह आपकी पार्किंग में पानी बचाने वाले तरीके से होती है। जुड़ते समय नोट में अपनी पार्किंग की जगह लिखें, और होस्ट कहे तो गाड़ी खुली रखकर चाबी गेट पर दे दें। ${BOOK_LINE.hi}`,
    hing: `Hamari car wash mein foam exterior wash, interior vacuum aur tyre va dashboard polish shamil hai, aur ye aapki parking mein paani bachane wale tareeke se hoti hai. Judte samay note mein apni parking ki jagah likhein, aur host kahe to gaadi khuli rakhkar chaabi gate par de dein. ${BOOK_LINE.hing}`,
  },
  {
    id: 'home-cleaning', service: 'home-cleaning', all: [G.clean], weight: 1,
    en: `Our deep home cleaning covers kitchen degreasing, bathroom descaling, floor scrubbing, and window and balcony wipe. A crew of about four takes around 5 hours per flat, and cleaning material is included. ${BOOK_LINE.en}`,
    hi: `हमारी डीप होम क्लीनिंग में किचन की चिकनाई साफ करना, बाथरूम की सफाई, फर्श की रगड़ाई और खिड़की व बालकनी की पोंछाई शामिल है। लगभग चार लोगों की टीम एक फ्लैट में करीब 5 घंटे लेती है, और सफाई का सामान साथ आता है। ${BOOK_LINE.hi}`,
    hing: `Hamari deep home cleaning mein kitchen ki chikna saaf karna, bathroom ki safai, farsh ki ragdai aur khidki va balcony ki ponchhai shamil hai. Lagbhag chaar logon ki team ek flat mein kareeb 5 ghante leti hai, aur safai ka saamaan saath aata hai. ${BOOK_LINE.hing}`,
  },
  {
    id: 'how-it-works', all: [G.how], weight: 1,
    en: `How Saath works:\n1. Pick a service and join your society's group (or start one).\n2. When enough flats join, the group price unlocks for everyone.\n3. The team arrives on the date, in the time slot shown on the group.\n4. Pay online, or pay the partner after the service.\n\nJoining is free, and if the target is not reached nothing is charged.`,
    hi: `Saath ऐसे काम करता है:\n1. कोई सर्विस चुनें और अपनी सोसाइटी के ग्रुप से जुड़ें (या नया ग्रुप शुरू करें)।\n2. जब ज़रूरी फ्लैट जुड़ जाते हैं तो सबके लिए ग्रुप प्राइस खुल जाता है।\n3. टीम ग्रुप में दी गई तारीख और टाइम स्लॉट में पहुँचती है।\n4. ऑनलाइन पेमेंट करें या सर्विस के बाद पार्टनर को दें।\n\nजुड़ना मुफ़्त है, और टारगेट पूरा न हो तो कुछ चार्ज नहीं होता।`,
    hing: `Saath aise kaam karta hai:\n1. Koi service chunein aur apni society ke group se judein (ya naya group shuru karein).\n2. Jab zaroori flats jud jaate hain to sabke liye group price khul jaata hai.\n3. Team group mein di gayi date aur time slot mein pahunchti hai.\n4. Online payment karein ya service ke baad partner ko dein.\n\nJudna free hai, aur target poora na ho to kuch charge nahi hota.`,
  },
  {
    id: 'pay', all: [G.pay], weight: 2,
    en: `Joining a group is free. Once the group price unlocks you can pay online (UPI, card or netbanking) from the group page, or pay the service partner by UPI or cash after the service. Online payment is safe: card and UPI details are handled by Razorpay, not by Saath.`,
    hi: `ग्रुप से जुड़ना मुफ़्त है। ग्रुप प्राइस खुलने के बाद आप ग्रुप पेज से ऑनलाइन (UPI, कार्ड या नेटबैंकिंग) भुगतान कर सकते हैं, या सर्विस के बाद पार्टनर को UPI या कैश दे सकते हैं। ऑनलाइन पेमेंट सुरक्षित है: कार्ड और UPI की जानकारी Razorpay संभालता है, Saath नहीं।`,
    hing: `Group se judna free hai. Group price khulne ke baad aap group page se online (UPI, card ya netbanking) payment kar sakte hain, ya service ke baad partner ko UPI ya cash de sakte hain. Online payment surakshit hai: card aur UPI ki jaankari Razorpay sambhalta hai, Saath nahi.`,
  },
  {
    id: 'refund', all: [G.refund], weight: 3,
    en: `If a group is cancelled, anything you paid online is refunded to the original payment method within 5 to 7 working days. To cancel your own booking, leave the group from its page before the service date. If you already paid online, contact support and we will help. If a completed service was not good, report it within 48 hours.`,
    hi: `अगर ग्रुप रद्द हो जाए तो ऑनलाइन दिया गया पैसा 5 से 7 कार्य दिवसों में उसी पेमेंट तरीके पर वापस आ जाता है। अपनी बुकिंग रद्द करने के लिए सर्विस की तारीख से पहले ग्रुप पेज से "Leave group" करें। ऑनलाइन पेमेंट कर चुके हों तो सपोर्ट से संपर्क करें, हम मदद करेंगे। पूरी हो चुकी सर्विस ठीक न लगे तो 48 घंटे में बताएँ।`,
    hing: `Agar group cancel ho jaye to online diya gaya paisa 5 se 7 kaam ke dino mein usi payment tareeke par wapas aa jaata hai. Apni booking cancel karne ke liye service ki date se pehle group page se "Leave group" karein. Online payment kar chuke hon to support se sampark karein, hum madad karenge. Poori ho chuki service theek na lage to 48 ghante mein batayein.`,
  },
  {
    id: 'slot', all: [G.slot], weight: 1,
    en: `Every group has a service date and an arrival window (for example 9 AM to 12 noon), shown on the group card and in My bookings. The team arrives anywhere inside that window and calls you before reaching. When you start a group you choose the date and slot.`,
    hi: `हर ग्रुप की एक सर्विस तारीख और आने का टाइम स्लॉट होता है (जैसे सुबह 9 से दोपहर 12), जो ग्रुप कार्ड और My bookings में दिखता है। टीम उसी स्लॉट में कभी भी पहुँचती है और पहुँचने से पहले आपको कॉल करती है। नया ग्रुप शुरू करते समय आप तारीख और स्लॉट खुद चुनते हैं।`,
    hing: `Har group ki ek service date aur aane ka time slot hota hai (jaise subah 9 se dopahar 12), jo group card aur My bookings mein dikhta hai. Team usi slot mein kabhi bhi pahunchti hai aur pahunchne se pehle aapko call karti hai. Naya group shuru karte samay aap date aur slot khud chunte hain.`,
  },
  {
    id: 'society', all: [G.society], weight: 2,
    en: `Saath covers societies and colonies across Uttar Pradesh. If yours is missing, open Sign up and tap "My society is not in the list" to add it. It becomes available straight away, and your neighbours can then join you.`,
    hi: `Saath उत्तर प्रदेश की सोसाइटियों और कॉलोनियों में चलता है। अगर आपकी सोसाइटी लिस्ट में नहीं है तो Sign up खोलकर "My society is not in the list" दबाएँ और जोड़ दें। वह तुरंत उपलब्ध हो जाती है और आपके पड़ोसी भी जुड़ सकते हैं।`,
    hing: `Saath Uttar Pradesh ki societies aur colonies mein chalta hai. Agar aapki society list mein nahi hai to Sign up kholkar "My society is not in the list" dabayein aur jod dein. Wo turant available ho jaati hai aur aapke padosi bhi jud sakte hain.`,
  },
  {
    id: 'login', all: [G.login], weight: 2,
    en: `To reset a forgotten password, open Log in and use "Forgot password". We send a code to your phone or email. New here? Sign up needs your name, email, a 10-digit mobile number, your society and your flat number.`,
    hi: `भूला हुआ पासवर्ड रीसेट करने के लिए Log in खोलें और "Forgot password" चुनें। आपके फोन या ईमेल पर कोड आएगा। नए हैं? Sign up के लिए नाम, ईमेल, 10 अंकों का मोबाइल नंबर, सोसाइटी और फ्लैट नंबर चाहिए।`,
    hing: `Bhoola hua password reset karne ke liye Log in kholein aur "Forgot password" chunein. Aapke phone ya email par code aayega. Naye hain? Sign up ke liye naam, email, 10 ank ka mobile number, society aur flat number chahiye.`,
  },
  {
    id: 'human', all: [G.human], weight: 2,
    en: `I can help with most questions here. To reach the Saath team, email {{support}} and mention your society and flat number. For an urgent problem during a visit, call the number the service partner gave you.`,
    hi: `ज़्यादातर सवालों में मैं यहीं मदद कर सकता हूँ। Saath टीम से संपर्क करने के लिए {{support}} पर ईमेल करें और अपनी सोसाइटी व फ्लैट नंबर लिखें। सर्विस के दौरान कोई ज़रूरी समस्या हो तो सर्विस पार्टनर का दिया नंबर मिलाएँ।`,
    hing: `Zyadatar sawaalon mein main yahin madad kar sakta hoon. Saath team se sampark karne ke liye {{support}} par email karein aur apni society va flat number likhein. Service ke dauran koi zaroori samasya ho to service partner ka diya number milayein.`,
  },
];

// ---- dynamic / general replies ---------------------------------------------------
export const GENERAL = {
  danger: {
    en: `This could be dangerous, so please do this first:\n- Switch the appliance off at the wall or the MCB.\n- Move away from it, and do not touch it with wet hands.\n- If there is fire or heavy smoke, leave the area and call 112.\n- If you smell gas, open windows, do not use switches, and call your gas provider or 112.\n\nA qualified technician should check it before you use it again.`,
    hi: `यह खतरनाक हो सकता है, इसलिए पहले ये करें:\n- उपकरण को स्विच या MCB से बंद करें।\n- उससे दूर हट जाएँ और गीले हाथों से न छुएँ।\n- आग या ज़्यादा धुआँ हो तो वहाँ से हटें और 112 पर कॉल करें।\n- गैस की गंध आए तो खिड़कियाँ खोलें, स्विच न दबाएँ और गैस कंपनी या 112 पर कॉल करें।\n\nदोबारा इस्तेमाल से पहले किसी योग्य टेक्नीशियन से जाँच कराएँ।`,
    hing: `Ye khatarnak ho sakta hai, isliye pehle ye karein:\n- Upkaran ko switch ya MCB se band karein.\n- Usse door hat jaayein aur geele haathon se na chhuyein.\n- Aag ya zyada dhuan ho to wahan se hatein aur 112 par call karein.\n- Gas ki gandh aaye to khidkiyan kholein, switch na dabayein aur gas company ya 112 par call karein.\n\nDobara istemaal se pehle kisi yogya technician se jaanch karwayein.`,
  },
  hello: {
    en: `Hi! I'm the Saath assistant. Ask me about a problem at home (for example "my AC is leaking water"), about our services and prices, or how group booking works. You can write in English, Hindi or Hinglish.`,
    hi: `नमस्ते! मैं Saath असिस्टेंट हूँ। घर की किसी समस्या (जैसे "मेरे AC से पानी टपक रहा है"), हमारी सेवाओं, कीमतों या ग्रुप बुकिंग के बारे में पूछिए। आप हिंदी, English या Hinglish में लिख सकते हैं।`,
    hing: `Namaste! Main Saath assistant hoon. Ghar ki kisi problem (jaise "mere AC se paani tapak raha hai"), hamari services, prices ya group booking ke baare mein poochiye. Aap Hindi, English ya Hinglish mein likh sakte hain.`,
  },
  thanks: {
    en: `You're welcome! If anything else at home needs sorting, just ask.`,
    hi: `आपका स्वागत है! घर में और कुछ ठीक करवाना हो तो बेझिझक पूछिए।`,
    hing: `Aapka swagat hai! Ghar mein aur kuch theek karwana ho to bejhijhak poochiye.`,
  },
  services: {
    en: `Saath services in your society: AC repair and service, car wash, deep home cleaning, water purifier service, pest control, and sofa and carpet cleaning. Tell me what is wrong, or pick one to see what it includes.`,
    hi: `आपकी सोसाइटी में Saath की सेवाएँ: AC रिपेयर और सर्विस, कार वॉश, डीप होम क्लीनिंग, वाटर प्यूरीफायर सर्विस, पेस्ट कंट्रोल, और सोफा-कालीन सफाई। बताइए क्या समस्या है, या कोई एक चुनकर देखिए उसमें क्या शामिल है।`,
    hing: `Aapki society mein Saath ki services: AC repair aur service, car wash, deep home cleaning, water purifier service, pest control, aur sofa-carpet safai. Bataiye kya problem hai, ya koi ek chunkar dekhiye usme kya shamil hai.`,
  },
  fallback: {
    en: `I'm not sure I understood. Could you describe the problem a little more, for example "AC is not cooling" or "sofa has a tea stain"? I can also tell you about our services, prices, payments and how group booking works.`,
    hi: `मैं ठीक से समझ नहीं पाया। क्या आप समस्या थोड़ी और बताएँगे, जैसे "AC ठंडा नहीं कर रहा" या "सोफे पर चाय का दाग है"? मैं हमारी सेवाओं, कीमतों, पेमेंट और ग्रुप बुकिंग के बारे में भी बता सकता हूँ।`,
    hing: `Main theek se samajh nahi paaya. Kya aap problem thodi aur bataenge, jaise "AC thanda nahi kar raha" ya "sofe par chai ka daag hai"? Main hamari services, prices, payment aur group booking ke baare mein bhi bata sakta hoon.`,
  },
  price: {
    one: {
      en: (s) => `${s.name}: regular price ₹${s.regular_price} per ${s.unit_label}. When enough neighbours join a group, everyone gets a lower group price. The exact group price is shown on each group.`,
      hi: (s) => `${s.name}: सामान्य कीमत ₹${s.regular_price} प्रति ${s.unit_label}। जब काफ़ी पड़ोसी ग्रुप में जुड़ते हैं तो सबको कम ग्रुप प्राइस मिलता है। सही ग्रुप प्राइस हर ग्रुप पर दिखता है।`,
      hing: (s) => `${s.name}: regular price ₹${s.regular_price} per ${s.unit_label}. Jab kaafi padosi group mein judte hain to sabko kam group price milta hai. Sahi group price har group par dikhta hai.`,
    },
    all: {
      en: (list) => `Regular prices:\n${list}\nWhen enough neighbours join a group, everyone gets a lower group price, shown on each group.`,
      hi: (list) => `सामान्य कीमतें:\n${list}\nजब काफ़ी पड़ोसी ग्रुप में जुड़ते हैं तो सबको कम ग्रुप प्राइस मिलता है, जो हर ग्रुप पर दिखता है।`,
      hing: (list) => `Regular prices:\n${list}\nJab kaafi padosi group mein judte hain to sabko kam group price milta hai, jo har group par dikhta hai.`,
    },
  },
  book: {
    en: `To book: open the service, choose your society's group (or start one with a date and time slot), and tap Join group. Add your parking bay or a note for the team if needed.`,
    hi: `बुक करने के लिए: सर्विस खोलें, अपनी सोसाइटी का ग्रुप चुनें (या तारीख और टाइम स्लॉट के साथ नया शुरू करें) और Join group दबाएँ। ज़रूरत हो तो पार्किंग या टीम के लिए नोट जोड़ें।`,
    hing: `Book karne ke liye: service kholein, apni society ka group chunein (ya date aur time slot ke saath naya shuru karein) aur Join group dabayein. Zaroorat ho to parking ya team ke liye note jodein.`,
  },
};

export function match(text) {
  const tokens = tokenize(text);
  const raw = norm(text);
  const has = (g) => hit(tokens, g, raw) > 0;

  // emergencies first: sparks, smoke, fire, shocks, or a gas smell
  const STRONG = G.danger.filter((w) => !['gas', 'current'].includes(w));
  const gasSmell = /gas.*(smell|leak|gandh|गंध|बदबू)|(smell|gandh|गंध|बदबू).*gas|गैस.*(गंध|बदबू|लीक)|current (lag|lagta|laga)|shock lag/.test(raw);
  if (hit(tokens, STRONG, raw) > 0 || gasSmell) return { kind: 'danger' };

  let best = null;
  for (const t of TOPICS) {
    if (!t.all.every((g) => has(g))) { if (!(t.any && t.all.some((g) => has(g)) && has(t.all[0]))) continue; }
    const score = t.weight * 10 + t.all.reduce((n, g) => n + hit(tokens, g, raw), 0);
    if (!best || score > best.score) best = { kind: 'topic', topic: t, score };
  }
  // a price question beats a plain service overview ("how much does pest control cost")
  if (has(G.price) && !has(['time', 'timing', 'samay', 'waqt', 'समय']) && (!best || best.topic.service)) return { kind: 'price' };
  if (best) return best;
  if (has(G.book)) return { kind: 'book' };
  if (has(G.hello) && tokens.length <= 4) return { kind: 'hello' };
  if (has(G.thanks) && tokens.length <= 4) return { kind: 'thanks' };
  if (has(G.services) && (has(['service', 'services', 'sevayen', 'सेवा', 'सेवाएं']))) return { kind: 'services' };
  return { kind: 'fallback' };
}

const SERVICE_WORDS = {
  'ac-repair': G.ac, 'car-wash': G.car, 'home-cleaning': G.clean, 'water-purifier': G.purifier,
  'pest-control': G.pest, 'sofa-cleaning': G.sofa,
};
export function detectService(text) {
  const tokens = tokenize(text); const raw = norm(text);
  let best = null;
  for (const [slug, words] of Object.entries(SERVICE_WORDS)) {
    const n = hit(tokens, words, raw);
    if (n > 0 && (!best || n > best.n)) best = { slug, n };
  }
  return best?.slug || null;
}
