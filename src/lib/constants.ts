export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
  "Online"
] as const;

export type NigerianState = (typeof NIGERIAN_STATES)[number];

export const EVENT_TYPES = [
  { value: "meetup", label: "Meetup" },
  { value: "hackathon", label: "Hackathon" },
  { value: "workshop", label: "Workshop" },
  { value: "conference", label: "Conference" },
  { value: "ama", label: "AMA" },
  { value: "online_session", label: "Online Session" },
  { value: "bootcamp", label: "Bootcamp" },
  { value: "summit", label: "Summit" },
  { value: "webinar", label: "Webinar" },
  { value: "other", label: "Other" },
] as const;

export const EVENT_TAGS = [
  "Beginner", "Developer", "Trading", "DeFi", "NFT", "AI", "DAO",
  "Gaming", "Metaverse", "Security", "Privacy", "Regulation",
  "Tokenomics", "Smart Contracts", "Layer 2", "Infrastructure",
  "Community", "Education", "Investment", "Research"
] as const;

export type EventType = (typeof EVENT_TYPES)[number]["value"];
