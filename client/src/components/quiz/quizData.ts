export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  pandaRemark?: string;
}

export const defaultQuestions: QuizQuestion[] = [
  {
    id: 1,
    question: "What is the primary purpose of an IR beam sensor at an entrance?",
    options: [
      "To measure room temperature",
      "To count people entering and exiting accurately",
      "To detect fire hazards",
      "To check attendee ID cards"
    ],
    correctIndex: 1,
    explanation: "IR beam sensors detect objects breaking the infrared beam, allowing accurate bidirectional entry/exit counting.",
    pandaRemark: "Beep boop! My sensors are sharp as bamboo shoots!"
  },
  {
    id: 2,
    question: "When a room reaches 100% capacity, what should the smart door servo do?",
    options: [
      "Open completely and stay open",
      "Swing back and forth rapidly",
      "Lock or restrict entry until occupants exit",
      "Disconnect from power"
    ],
    correctIndex: 2,
    explanation: "At maximum capacity, the door restricts new entries to prevent overcrowding and ensure safety.",
    pandaRemark: "Safety first! Even hungry pandas have to queue politely!"
  },
  {
    id: 3,
    question: "Which communication protocol is ideal for lightweight, low-bandwidth IoT sensor telemetry?",
    options: [
      "FTP",
      "MQTT (Message Queuing Telemetry Transport)",
      "SMTP",
      "BGP"
    ],
    correctIndex: 1,
    explanation: "MQTT uses a lightweight publish/subscribe model engineered specifically for IoT devices and unreliable networks.",
    pandaRemark: "MQTT carries my messages super fast across the clouds!"
  },
  {
    id: 4,
    question: "What does the 'Occupancy Warning Threshold' (e.g. 80%) typically signify?",
    options: [
      "The system has crashed",
      "The room is approaching capacity and operators should monitor flow",
      "The building is completely empty",
      "Sensors need recalibration"
    ],
    correctIndex: 1,
    explanation: "The 80% warning gives facility staff proactive advance notice before critical overcrowding occurs.",
    pandaRemark: "Warning lights help us prepare before the crowd gets too squishy!"
  },
  {
    id: 5,
    question: "What does WebSockets (like Socket.IO) provide in the CrowdMonitor dashboard?",
    options: [
      "Real-time instant data push without page reloads",
      "Automatic battery charging for laptops",
      "Hardware motor control over analog wires",
      "Permanent video surveillance"
    ],
    correctIndex: 0,
    explanation: "WebSockets maintain a full-duplex persistent connection so counts update on your screen in milliseconds.",
    pandaRemark: "Zoom! That was fast like lightning!"
  },
  {
    id: 6,
    question: "Why is hysteresis (debounce delay) applied to optical passage sensors?",
    options: [
      "To slow down people entering",
      "To prevent single passages from being double-counted due to beam flicker",
      "To save battery on the LCD display",
      "To make the buzzer louder"
    ],
    correctIndex: 1,
    explanation: "Debounce delays prevent clothing flutter or arm swinging from registering multiple false count events.",
    pandaRemark: "No double counting allowed! One panda, one count!"
  },
  {
    id: 7,
    question: "In crowd management safety regulations, what is the main risk of exceeding safe capacity?",
    options: [
      "Higher air conditioner electric bills",
      "Severe bottlenecks, delayed emergency evacuation, and crushing hazards",
      "Faster internet connection speeds",
      "Wi-Fi frequency interference"
    ],
    correctIndex: 1,
    explanation: "Overcrowding leads to stampede risks and blocks emergency escape routes during evacuations.",
    pandaRemark: "Keep doorways clear and everyone stays safe and happy!"
  },
  {
    id: 8,
    question: "What does an 'MQTT Stale' indicator warn the facility operator about?",
    options: [
      "The sensors haven't sent a heartbeat within the expected time window",
      "The database is full",
      "The room needs fresh air",
      "The LCD screen color has faded"
    ],
    correctIndex: 0,
    explanation: "Stale telemetry indicates potential network disruption or hardware power loss.",
    pandaRemark: "Uh oh, when I don't hear a ping, I wave my bamboo flag to check the cable!"
  },
  {
    id: 9,
    question: "Which of the following describes bidirectional crowd flow monitoring?",
    options: [
      "Only counting people entering",
      "Only counting people leaving",
      "Tracking both inward and outward transitions to maintain net live count",
      "Measuring crowd walking speed only"
    ],
    correctIndex: 2,
    explanation: "Net occupancy requires tracking both entry and exit events continuously (Live = Entries - Exits).",
    pandaRemark: "Math is fun: bamboo in minus bamboo out equals bamboo left!"
  },
  {
    id: 10,
    question: "What is the optimal crowd density threshold (persons/m²) for comfortable free movement?",
    options: [
      "Under 1 to 1.5 persons per square meter",
      "Over 6 persons per square meter",
      "10 to 12 persons per square meter",
      "20 persons per square meter"
    ],
    correctIndex: 0,
    explanation: "Densities below 1.5 persons/m² allow smooth, unconstrained movement. Above 4 persons/m² flow severely deteriorates.",
    pandaRemark: "Give everyone personal bubble space to munch snacks happily!"
  }
];
