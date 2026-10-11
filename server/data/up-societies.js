// Uttar Pradesh societies and residential colonies, grouped by city.
// Format: [name, area, city, approx flats (0 = unknown)].
//
// Coverage note: Noida / Greater Noida West / Ghaziabad / Lucknow list well-known apartment
// complexes. For other cities the entries are locality-level resident colonies (RWAs).
// Every resident can also add a missing society from the sign-up page, so the list grows
// by itself. Please review names before launch and fix anything that is not accurate.

const NOIDA = 'Noida';
const GNW = 'Greater Noida West';
const GN = 'Greater Noida';
const GZB = 'Ghaziabad';
const LKO = 'Lucknow';

export const UP_SOCIETIES = [
  // ---- Noida ----
  ['Supertech Capetown', 'Sector 74', NOIDA, 0],
  ['Supertech Emerald Court', 'Sector 93A', NOIDA, 0],
  ['ATS Pristine', 'Sector 150', NOIDA, 0],
  ['ATS One Hamlet', 'Sector 104', NOIDA, 0],
  ['ATS Le Grandiose', 'Sector 150', NOIDA, 0],
  ['Jaypee Wish Town', 'Sector 128', NOIDA, 0],
  ['Jaypee Greens Kosmos', 'Sector 134', NOIDA, 0],
  ['Mahagun Moderne', 'Sector 78', NOIDA, 0],
  ['Hyde Park Noida', 'Sector 78', NOIDA, 0],
  ['Amrapali Sapphire', 'Sector 45', NOIDA, 0],
  ['Amrapali Silicon City', 'Sector 76', NOIDA, 0],
  ['Amrapali Zodiac', 'Sector 120', NOIDA, 0],
  ['Amrapali Eden Park', 'Sector 50', NOIDA, 0],
  ['Eldeco Utopia', 'Sector 93A', NOIDA, 0],
  ['Lotus Boulevard', 'Sector 100', NOIDA, 0],
  ['Prateek Wisteria', 'Sector 77', NOIDA, 0],
  ['Prateek Laurel', 'Sector 120', NOIDA, 0],
  ['Unitech Fresco', 'Sector 50', NOIDA, 0],
  ['Panchsheel Pratishtha', 'Sector 75', NOIDA, 0],
  ['Logix Blossom County', 'Sector 137', NOIDA, 0],
  ['Paras Tierea', 'Sector 137', NOIDA, 0],
  ['Paras Seasons', 'Sector 168', NOIDA, 0],
  ['Ajnara Homes', 'Sector 129', NOIDA, 0],
  ['Gulshan Botnia', 'Sector 144', NOIDA, 0],
  ['Cleo County', 'Sector 121', NOIDA, 0],
  ['Ace Golfshire', 'Sector 150', NOIDA, 0],
  ['Sector 62 Residents Welfare Association', 'Sector 62', NOIDA, 0],
  ['Sector 50 Residents Welfare Association', 'Sector 50', NOIDA, 0],
  ['Sector 15A Residents Welfare Association', 'Sector 15A', NOIDA, 0],
  ['Sector 29 Residents Welfare Association', 'Sector 29', NOIDA, 0],

  // ---- Greater Noida West (Noida Extension) ----
  ['Gaur City 1', 'Sector 4', GNW, 0],
  ['Gaur City 2', 'Sector 16C', GNW, 0],
  ['Gaur Saundaryam', 'Tech Zone 4', GNW, 0],
  ['Mahagun Mywoods', 'Sector 16C', GNW, 0],
  ['Ajnara Le Garden', 'Sector 16B', GNW, 0],
  ['Supertech Eco Village 2', 'Sector 16B', GNW, 0],
  ['Amrapali Leisure Valley', 'Tech Zone 4', GNW, 0],
  ['Panchsheel Greens 1', 'Sector 16', GNW, 0],
  ['Panchsheel Greens 2', 'Sector 16B', GNW, 0],
  ['Ace City', 'Sector 1', GNW, 0],
  ['Saya Zion', 'Sector 4', GNW, 0],
  ['Galaxy North Avenue', 'Sector 16B', GNW, 0],

  // ---- Greater Noida ----
  ['Alpha 1 Residents Welfare Association', 'Alpha 1', GN, 0],
  ['Beta 1 Residents Welfare Association', 'Beta 1', GN, 0],
  ['Gamma 1 Residents Welfare Association', 'Gamma 1', GN, 0],
  ['Delta 1 Residents Welfare Association', 'Delta 1', GN, 0],
  ['Pi 1 Residents Welfare Association', 'Pi 1', GN, 0],
  ['Omicron 1 Residents Welfare Association', 'Omicron 1', GN, 0],

  // ---- Ghaziabad ----
  ['Crossings Republik', 'NH-24', GZB, 0],
  ['Mahagun Mascot', 'Crossings Republik', GZB, 0],
  ['Shipra Suncity', 'Indirapuram', GZB, 0],
  ['ATS Advantage', 'Ahinsa Khand 1, Indirapuram', GZB, 0],
  ['Gaur Green Avenue', 'Abhay Khand, Indirapuram', GZB, 0],
  ['Prateek Grand City', 'Siddharth Vihar', GZB, 0],
  ['Ahinsa Khand 2 Residents Welfare Association', 'Indirapuram', GZB, 0],
  ['Vaibhav Khand Residents Welfare Association', 'Indirapuram', GZB, 0],
  ['Raj Nagar Extension Residents Welfare Association', 'Raj Nagar Extension', GZB, 0],
  ['Vasundhara Residents Welfare Association', 'Vasundhara', GZB, 0],
  ['Kaushambi Residents Welfare Association', 'Kaushambi', GZB, 0],
  ['Vaishali Residents Welfare Association', 'Vaishali', GZB, 0],
  ['Shastri Nagar Residents Welfare Association', 'Shastri Nagar', GZB, 0],
  ['Kavi Nagar Residents Welfare Association', 'Kavi Nagar', GZB, 0],
  ['Nehru Nagar Residents Welfare Association', 'Nehru Nagar', GZB, 0],

  // ---- Lucknow ----
  ['Omaxe City', 'Shaheed Path', LKO, 0],
  ['Sushant Golf City', 'Shaheed Path', LKO, 0],
  ['Vibhuti Khand Residents Welfare Association', 'Gomti Nagar', LKO, 0],
  ['Vinay Khand Residents Welfare Association', 'Gomti Nagar', LKO, 0],
  ['Viraj Khand Residents Welfare Association', 'Gomti Nagar', LKO, 0],
  ['Vipul Khand Residents Welfare Association', 'Gomti Nagar', LKO, 0],
  ['Vikalp Khand Residents Welfare Association', 'Gomti Nagar', LKO, 0],
  ['Patrakarpuram Residents Welfare Association', 'Gomti Nagar', LKO, 0],
  ['Indira Nagar Residents Welfare Association', 'Indira Nagar', LKO, 0],
  ['Aliganj Residents Welfare Association', 'Aliganj', LKO, 0],
  ['Mahanagar Residents Welfare Association', 'Mahanagar', LKO, 0],
  ['Aashiana Residents Welfare Association', 'Aashiana', LKO, 0],
  ['Jankipuram Residents Welfare Association', 'Jankipuram', LKO, 0],
  ['Rajajipuram Residents Welfare Association', 'Rajajipuram', LKO, 0],
  ['Alambagh Residents Welfare Association', 'Alambagh', LKO, 0],
  ['Vrindavan Yojana Residents Welfare Association', 'Raebareli Road', LKO, 0],

  // ---- Kanpur ----
  ['Swaroop Nagar Residents Welfare Association', 'Swaroop Nagar', 'Kanpur', 0],
  ['Kidwai Nagar Residents Welfare Association', 'Kidwai Nagar', 'Kanpur', 0],
  ['Arya Nagar Residents Welfare Association', 'Arya Nagar', 'Kanpur', 0],
  ['Civil Lines Residents Welfare Association', 'Civil Lines', 'Kanpur', 0],
  ['Govind Nagar Residents Welfare Association', 'Govind Nagar', 'Kanpur', 0],
  ['Kakadeo Residents Welfare Association', 'Kakadeo', 'Kanpur', 0],
  ['Shyam Nagar Residents Welfare Association', 'Shyam Nagar', 'Kanpur', 0],
  ['Kalyanpur Residents Welfare Association', 'Kalyanpur', 'Kanpur', 0],

  // ---- Agra ----
  ['Kamla Nagar Residents Welfare Association', 'Kamla Nagar', 'Agra', 0],
  ['Sanjay Place Residents Welfare Association', 'Sanjay Place', 'Agra', 0],
  ['Shahganj Residents Welfare Association', 'Shahganj', 'Agra', 0],
  ['Sikandra Residents Welfare Association', 'Sikandra', 'Agra', 0],
  ['Dayalbagh Residents Welfare Association', 'Dayalbagh', 'Agra', 0],
  ['Taj Nagri Residents Welfare Association', 'Taj Nagri', 'Agra', 0],
  ['Balkeshwar Residents Welfare Association', 'Balkeshwar', 'Agra', 0],
  ['Pratap Pura Residents Welfare Association', 'Pratap Pura', 'Agra', 0],

  // ---- Varanasi ----
  ['Sigra Residents Welfare Association', 'Sigra', 'Varanasi', 0],
  ['Lanka Residents Welfare Association', 'Lanka', 'Varanasi', 0],
  ['Bhelupur Residents Welfare Association', 'Bhelupur', 'Varanasi', 0],
  ['Mahmoorganj Residents Welfare Association', 'Mahmoorganj', 'Varanasi', 0],
  ['Varanasi Cantt Residents Welfare Association', 'Cantt', 'Varanasi', 0],
  ['Shivpur Residents Welfare Association', 'Shivpur', 'Varanasi', 0],
  ['Pandeypur Residents Welfare Association', 'Pandeypur', 'Varanasi', 0],

  // ---- Prayagraj ----
  ['Civil Lines Residents Welfare Association', 'Civil Lines', 'Prayagraj', 0],
  ['George Town Residents Welfare Association', 'George Town', 'Prayagraj', 0],
  ['Allenganj Residents Welfare Association', 'Allenganj', 'Prayagraj', 0],
  ['Teliarganj Residents Welfare Association', 'Teliarganj', 'Prayagraj', 0],
  ['Naini Residents Welfare Association', 'Naini', 'Prayagraj', 0],
  ['Jhunsi Residents Welfare Association', 'Jhunsi', 'Prayagraj', 0],
  ['Mumfordganj Residents Welfare Association', 'Mumfordganj', 'Prayagraj', 0],

  // ---- Meerut ----
  ['Shastri Nagar Residents Welfare Association', 'Shastri Nagar', 'Meerut', 0],
  ['Defence Colony Residents Welfare Association', 'Defence Colony', 'Meerut', 0],
  ['Model Town Residents Welfare Association', 'Model Town', 'Meerut', 0],
  ['Pallavpuram Residents Welfare Association', 'Pallavpuram', 'Meerut', 0],
  ['Ganga Nagar Residents Welfare Association', 'Ganga Nagar', 'Meerut', 0],
  ['Garh Road Residents Welfare Association', 'Garh Road', 'Meerut', 0],
  ['Sainik Vihar Residents Welfare Association', 'Sainik Vihar', 'Meerut', 0],

  // ---- Bareilly ----
  ['Civil Lines Residents Welfare Association', 'Civil Lines', 'Bareilly', 0],
  ['Rampur Garden Residents Welfare Association', 'Rampur Garden', 'Bareilly', 0],
  ['Izzatnagar Residents Welfare Association', 'Izzatnagar', 'Bareilly', 0],
  ['DD Puram Residents Welfare Association', 'DD Puram', 'Bareilly', 0],
  ['Subhash Nagar Residents Welfare Association', 'Subhash Nagar', 'Bareilly', 0],

  // ---- Aligarh ----
  ['Civil Lines Residents Welfare Association', 'Civil Lines', 'Aligarh', 0],
  ['Ramghat Road Residents Welfare Association', 'Ramghat Road', 'Aligarh', 0],
  ['Medical Road Residents Welfare Association', 'Medical Road', 'Aligarh', 0],
  ['Marris Road Residents Welfare Association', 'Marris Road', 'Aligarh', 0],

  // ---- Gorakhpur ----
  ['Rapti Nagar Residents Welfare Association', 'Rapti Nagar', 'Gorakhpur', 0],
  ['Medical College Road Residents Welfare Association', 'Medical College Road', 'Gorakhpur', 0],
  ['Betiahata Residents Welfare Association', 'Betiahata', 'Gorakhpur', 0],
  ['Civil Lines Residents Welfare Association', 'Civil Lines', 'Gorakhpur', 0],
  ['Taramandal Residents Welfare Association', 'Taramandal', 'Gorakhpur', 0],

  // ---- Mathura-Vrindavan ----
  ['Krishna Nagar Residents Welfare Association', 'Krishna Nagar', 'Mathura', 0],
  ['Civil Lines Residents Welfare Association', 'Civil Lines', 'Mathura', 0],
  ['Parikrama Marg Residents Welfare Association', 'Vrindavan', 'Mathura', 0],

  // ---- Other cities ----
  ['Civil Lines Residents Welfare Association', 'Civil Lines', 'Jhansi', 0],
  ['Sipri Bazaar Residents Welfare Association', 'Sipri Bazaar', 'Jhansi', 0],
  ['Civil Lines Residents Welfare Association', 'Civil Lines', 'Moradabad', 0],
  ['Ram Ganga Vihar Residents Welfare Association', 'Ram Ganga Vihar', 'Moradabad', 0],
  ['Civil Lines Residents Welfare Association', 'Civil Lines', 'Saharanpur', 0],
  ['Civil Lines Residents Welfare Association', 'Civil Lines', 'Muzaffarnagar', 0],
  ['Shastri Nagar Residents Welfare Association', 'Shastri Nagar', 'Muzaffarnagar', 0],
  ['Saket Nagar Residents Welfare Association', 'Saket Nagar', 'Ayodhya', 0],
  ['Civil Lines Residents Welfare Association', 'Civil Lines', 'Firozabad', 0],
];

// Used by the "add my society" form.
export const UP_CITIES = [
  'Noida', 'Greater Noida', 'Greater Noida West', 'Ghaziabad', 'Lucknow', 'Kanpur', 'Agra', 'Varanasi',
  'Prayagraj', 'Meerut', 'Bareilly', 'Aligarh', 'Gorakhpur', 'Mathura', 'Jhansi', 'Moradabad',
  'Saharanpur', 'Muzaffarnagar', 'Ayodhya', 'Firozabad', 'Other (Uttar Pradesh)',
];
