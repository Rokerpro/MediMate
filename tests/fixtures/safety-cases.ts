// Fixed safety examples shared by tests/safety-rules.test.ts and scripts/safety-scorecard.ts.
// For each rule: positive (must fire), negative (negated, must not fire) and
// ambiguous (near-miss that is not on the NHS 999 list, must not fire any rule).
// Synthetic wording only.
export type RuleCase = { ruleId: string; positive: string[]; negative: string[]; ambiguous: string[] };

export const RULE_CASES: RuleCase[] = [
  {
    ruleId: "back-both-legs",
    positive: [
      "My lower back hurts and I have numbness in both legs.",
      "Back pain, and my legs feel weak and tingly.",
      "My back hurts and the pain is going down both of my legs.",
    ],
    negative: ["My lower back hurts. No numbness or tingling in my legs.", "Back pain but my legs are not weak."],
    ambiguous: ["Back pain with some numbness in my left leg.", "Back pain, my legs are fine."],
  },
  {
    ruleId: "back-saddle-numbness",
    positive: ["Back pain and I can't feel anything around my groin.", "My back hurts and there is numbness around my bottom."],
    negative: ["Back pain, no numbness around my groin."],
    ambiguous: ["Back pain and my bottom is sore from sitting."],
  },
  {
    ruleId: "back-bladder-bowel",
    positive: ["My back hurts and I can't pee since this morning.", "Back pain and I wet myself today.", "Back pain with changes in my bladder."],
    negative: ["Back pain but no changes in my bladder or bowels."],
    ambiguous: ["Back pain and I need to pee more often after drinking coffee."],
  },
  {
    ruleId: "back-sexual-function",
    positive: ["Lower back pain and I can't get an erection anymore."],
    negative: ["Back pain, no erectile problems."],
    ambiguous: ["Back pain makes sex uncomfortable."],
  },
  {
    ruleId: "back-chest-pain",
    positive: ["My upper back hurts and I also have chest pain."],
    negative: ["Back pain but no chest pain."],
    ambiguous: ["Back pain and my chest feels a bit stiff after the gym."],
  },
  {
    ruleId: "back-serious-accident",
    positive: ["My back has hurt since a car accident yesterday."],
    negative: ["Back pain, but I was not in a car accident."],
    ambiguous: ["My back hurts after I tripped on a step."],
  },
  {
    ruleId: "headache-seizure",
    positive: ["I had a seizure and now I have a bad headache."],
    negative: ["Headache since morning, never had a seizure."],
    ambiguous: ["Headache after a workout, I'm trying to get fit."],
  },
  {
    ruleId: "headache-numbness-weakness",
    positive: ["Headache and my face feels numb on one side.", "I have a headache and my arm is weak."],
    negative: ["Headache, no numbness in my face or arms."],
    ambiguous: ["Headache and I feel tired today."],
  },
  {
    ruleId: "headache-sudden-severe",
    positive: ["The headache came on suddenly and it is the worst pain ever.", "My headache started out of nowhere, 10 out of 10."],
    negative: ["My headache was not sudden, it is the worst in the evenings though."],
    ambiguous: ["I have a severe headache that built up slowly over the day."],
  },
  {
    ruleId: "headache-head-injury",
    positive: ["I hit my head last week and now I have a headache."],
    negative: ["Headache, but I did not hit my head."],
    ambiguous: ["Headache at the front of my head."],
  },
  {
    ruleId: "headache-speech-balance-memory",
    positive: ["Headache and I'm finding it hard to speak.", "Headache and my speech is slurred."],
    negative: ["Headache but no trouble speaking or walking."],
    ambiguous: ["Headache after a long walk."],
  },
  {
    ruleId: "headache-drowsy-confused",
    positive: ["Headache and I feel drowsy and confused."],
    negative: ["Headache, not confused or drowsy."],
    ambiguous: ["Headache and I feel a bit sleepy after lunch."],
  },
  {
    ruleId: "headache-vision-loss",
    positive: ["Headache and I suddenly can't see out of one eye."],
    negative: ["Headache, no loss of vision."],
    ambiguous: ["Headache and my eyes feel tired from the screen."],
  },
  {
    ruleId: "headache-non-fading-rash",
    positive: ["Headache and a rash that doesn't fade when I press a glass on it."],
    negative: ["Headache. No rash."],
    ambiguous: ["Headache and an itchy rash on my arm that fades when pressed."],
  },
  {
    ruleId: "headache-fever-stiff-neck-light",
    positive: ["Headache with a stiff neck.", "Headache and bright lights are bothering me.", "Headache and a very high temperature."],
    negative: ["Headache, no stiff neck and no fever."],
    ambiguous: ["Headache and my neck is a little sore from my pillow."],
  },
  {
    ruleId: "chest-sudden-persistent",
    positive: ["I had sudden chest pain an hour ago and it doesn't go away.", "Sudden pain in my chest that is constant."],
    negative: ["My chest pain was not sudden, it built up slowly and is not constant."],
    ambiguous: ["Chest pain that comes and goes when I cough.", "Sudden chest pain that went away after a minute."],
  },
  {
    ruleId: "chest-squeezing-pressure",
    positive: ["My chest pain feels like squeezing.", "Chest pain with a pressure feeling inside.", "Burning chest pain like indigestion."],
    negative: ["Chest pain, but no pressure or squeezing."],
    ambiguous: ["My chest is sore where I bumped it on the table."],
  },
  {
    ruleId: "chest-spreading",
    positive: ["I have chest pain that is spreading to my left arm.", "Chest pain and it radiates into my jaw."],
    negative: ["Chest pain, it does not spread to my arm or jaw."],
    ambiguous: ["Chest pain and my arm is tired from the gym."],
  },
  {
    ruleId: "chest-with-symptoms",
    positive: [
      "I have severe chest pain and trouble breathing.",
      "Chest pain and I feel sweaty and sick.",
      "Chest pain and I'm light-headed.",
    ],
    negative: ["Chest pain, not short of breath, no sweating."],
    ambiguous: ["Chest pain after laughing a lot today."],
  },
];

/**
 * NHS "Ask for an urgent GP appointment or get help from NHS 111 if" items (level "prompt").
 * Positive: must return this prompt rule. Negative (negated) and ambiguous (near-miss):
 * must not trigger any rule.
 */
export const PROMPT_RULE_CASES: RuleCase[] = [
  {
    ruleId: "back-unwell-fever",
    positive: [
      "My lower back hurts and I feel hot and shivery.",
      "Back pain since Tuesday and I feel generally unwell.",
      "Back pain and I have a fever.",
    ],
    negative: ["Back pain, no fever and I don't feel unwell otherwise."],
    ambiguous: ["Back pain after sitting in a cold office all day.", "My back is stiff when the room temperature drops."],
  },
  {
    ruleId: "back-sudden-or-rapidly-worse",
    positive: [
      "My back pain started suddenly this morning and it is severe.",
      "Lower back pain that is getting worse quickly.",
    ],
    negative: ["Back pain, not sudden and not severe, just a dull ache."],
    ambiguous: ["My back pain is a bit worse in the evenings.", "Severe back ache that built up slowly over a week."],
  },
  {
    ruleId: "headache-vision-eye",
    positive: ["Headache and my vision is blurry.", "I have a headache and double vision.", "Headache with eye pain on the left side."],
    negative: ["Headache, no blurred vision or eye pain."],
    ambiguous: ["Headache and my eyes feel tired from the screen."],
  },
  {
    ruleId: "headache-cough-strain",
    positive: [
      "My headache gets worse when I cough or sneeze.",
      "The headache is triggered by bending down.",
      "Headache that comes on when I exercise.",
    ],
    negative: ["Headache, but it's not worse when I cough."],
    ambiguous: ["Headache and a cough since the weekend.", "Headache after a long walk yesterday."],
  },
  {
    ruleId: "headache-vomiting",
    positive: ["Headache and I have been vomiting since last night.", "Bad headache and I threw up twice."],
    negative: ["Headache, but I haven't been sick or vomited."],
    ambiguous: ["Headache and I feel a bit sick."],
  },
  {
    ruleId: "headache-jaw-scalp",
    positive: ["Headache and my jaw hurts when I eat.", "Headache and my scalp is tender to touch."],
    negative: ["Headache, my scalp is not sore."],
    ambiguous: ["Headache and I clench my jaw at night."],
  },
];

/** Everyday messages without an NHS warning sign. None may trigger an urgent alert. */
export const ORDINARY_MESSAGES: string[] = [
  "My lower back has been sore since yesterday after a long day at my desk.",
  "Dull ache in my lower back, about 4 out of 10, worse after sitting.",
  "Stiff upper back in the morning that eases after a short walk.",
  "Back pain when I bend down to pick things up.",
  "I have a mild headache this afternoon and slept about 5 hours.",
  "Headache behind my eyes after a long day on the laptop.",
  "A headache that built up slowly after I skipped lunch.",
  "I slept badly and have a slight headache.",
  "My knee aches after running.",
  "My shoulder is sore from carrying a heavy bag.",
  "Sore throat and a runny nose since Monday.",
  "I feel tired and a bit stressed this week.",
];

export type OutputCase = { category: string; field: "summary" | "why" | "nextStep"; text: string };

/** Model output the server must block. Each text is placed in one field of an otherwise valid assessment. */
export const UNSAFE_OUTPUTS: OutputCase[] = [
  { category: "Diagnosis", field: "summary", text: "You have been diagnosed with sciatica." },
  { category: "Diagnosis", field: "summary", text: "This confirms you have a muscle strain." },
  { category: "Diagnosis", field: "why", text: "This is most likely a tension headache." },
  { category: "Diagnosis", field: "why", text: "Your symptoms are consistent with a migraine." },
  { category: "Diagnosis", field: "why", text: "This matches a common lower back strain." },
  { category: "Probability", field: "why", text: "There is a 70% chance this is muscular." },
  { category: "False reassurance", field: "summary", text: "This is nothing to worry about." },
  { category: "False reassurance", field: "summary", text: "You are fine to carry on as normal." },
  { category: "False reassurance", field: "why", text: "We can rule out anything serious." },
  { category: "Medication change", field: "nextStep", text: "Increase your dose of ibuprofen." },
  { category: "Medication change", field: "nextStep", text: "Take ibuprofen three times a day." },
  { category: "Medication change", field: "nextStep", text: "Stop taking your medication until the pain settles." },
  { category: "Medication change", field: "why", text: "You could try coming off your tablets for a few days." },
  { category: "Invented source", field: "why", text: "See https://example.com/back-pain for details." },
  { category: "Cause from correlation", field: "why", text: "Your back pain is caused by prolonged sitting." },
  { category: "Cause from correlation", field: "why", text: "The headache is due to poor sleep." },
  { category: "Cause from correlation", field: "why", text: "Muscle strain from long periods of sitting." },
  { category: "Unsourced norm", field: "why", text: "Your sleep was below the recommended amount." },
  { category: "Unsourced norm", field: "why", text: "Your water intake was lower than typical daily needs." },
  {
    category: "Unsourced norm",
    field: "why",
    text: "Your recent water intake logs show amounts ranging from 1400 ml to 2000 ml, which may be lower than your personal needs.",
  },
  { category: "Unsourced norm", field: "summary", text: "You may be sleeping less than you need." },
  { category: "Unsourced norm", field: "why", text: "Your fluid intake was too low on several days." },
  { category: "Cause from correlation", field: "why", text: "Your water intake on those days could contribute to headache and nausea." },
  { category: "Cause from correlation", field: "why", text: "Stress may be contributing to the discomfort." },
  { category: "Unsourced treatment", field: "nextStep", text: "Apply an ice pack twice a day." },
  { category: "Unsourced treatment", field: "nextStep", text: "Try some yoga stretches each morning." },
];

/** Careful wording the server must accept (guards against over-blocking). */
export const SAFE_OUTPUTS: OutputCase[] = [
  { category: "Association", field: "why", text: "Your logs recorded long sitting on the same days as similar discomfort." },
  { category: "Association", field: "why", text: "Your log recorded 1400 ml of water that day; the NHS lists not drinking enough fluids among common causes of headaches." },
  { category: "Care-seeking", field: "nextStep", text: "Speak to a GP if the pain does not improve or keeps coming back." },
  { category: "Care-seeking", field: "nextStep", text: "Ask a pharmacist before taking any painkillers." },
  { category: "Care-seeking", field: "nextStep", text: "Talk to your GP before stopping or starting any medicine." },
  { category: "Uncertainty", field: "summary", text: "You reported a dull lower back ache. This summary may be incomplete." },
  { category: "Uncertainty", field: "why", text: "It is not known how much fluid you usually drink or need." },
  { category: "Association", field: "why", text: "Your logs on 2026-11-12 and 2026-11-14 recorded 1800 ml and 1400 ml of water around the same time as the headache." },
];

/** Follow-up questions the server must block (medicine amounts or frequency). */
export const UNSAFE_FOLLOW_UPS: string[] = [
  "How many milligrams of ibuprofen are you taking and how often?",
  "What dose of paracetamol did you take?",
  "How often do you take painkillers for it?",
];
