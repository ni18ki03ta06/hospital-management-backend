const router = require('express').Router();
const { protect } = require('../middleware/auth');

// ─── Cardiac Health Knowledge Base ───────────────────────────────────────────
const KB = [
  // Symptoms
  { keys: ['chest pain', 'chest ache', 'chest pressure', 'chest tightness'], response: '🚨 Chest pain can be a sign of a cardiac event. If severe, call 108 immediately. Common causes include angina, heart attack, or GERD. Please consult Dr. Ravikant Patil urgently.' },
  { keys: ['shortness of breath', 'breathless', 'difficulty breathing', 'cant breathe'], response: '⚠️ Shortness of breath can indicate heart failure, arrhythmia, or pulmonary issues. If sudden and severe, call 102 (Ambulance). Book an appointment via the Appointments tab.' },
  { keys: ['palpitation', 'heart racing', 'fast heartbeat', 'irregular heartbeat', 'heart flutter'], response: '💓 Palpitations may indicate arrhythmia or atrial fibrillation. Avoid caffeine and stress. If persistent, request a consultation via the Appointments tab.' },
  { keys: ['dizziness', 'dizzy', 'lightheaded', 'vertigo', 'fainting', 'faint'], response: '😵 Dizziness can be caused by low blood pressure, arrhythmia, or dehydration. Sit down immediately. If it persists, contact your doctor through the Chat tab.' },
  { keys: ['swelling', 'swollen feet', 'swollen legs', 'edema', 'ankle swelling'], response: '🦵 Leg/ankle swelling can indicate heart failure or venous insufficiency. Elevate your legs and reduce salt intake. Please schedule a consultation.' },
  { keys: ['fatigue', 'tired', 'weakness', 'exhausted', 'no energy'], response: '😴 Unexplained fatigue can be a symptom of heart disease or anemia. Ensure adequate rest and hydration. If persistent, consult your doctor.' },
  { keys: ['high blood pressure', 'hypertension', 'bp high', 'blood pressure'], response: '🩺 High blood pressure is a major cardiac risk factor. Target: below 130/80 mmHg. Take medications as prescribed, reduce salt, exercise regularly, and avoid stress.' },
  { keys: ['low blood pressure', 'hypotension', 'bp low'], response: '⬇️ Low blood pressure can cause dizziness and fainting. Stay hydrated, avoid standing up quickly, and increase salt slightly if advised by your doctor.' },
  { keys: ['heart attack', 'myocardial infarction', 'mi', 'cardiac arrest'], response: '🚨 EMERGENCY: If you suspect a heart attack — chest pain radiating to arm/jaw, sweating, nausea — call 108 IMMEDIATELY. Chew aspirin 325mg if available and not allergic.' },
  { keys: ['stroke', 'brain attack', 'paralysis', 'face drooping'], response: '🚨 EMERGENCY: Signs of stroke — face drooping, arm weakness, speech difficulty. Call 108 IMMEDIATELY. Time is critical — every minute matters.' },
  { keys: ['cholesterol', 'ldl', 'hdl', 'triglycerides'], response: '🧪 Healthy cholesterol: LDL < 100 mg/dL, HDL > 60 mg/dL, Triglycerides < 150 mg/dL. Reduce saturated fats, exercise regularly, and take statins if prescribed.' },
  { keys: ['diabetes', 'blood sugar', 'glucose', 'insulin'], response: '🩸 Diabetes significantly increases cardiac risk. Target HbA1c < 7%. Monitor blood sugar regularly, follow diet, exercise, and take medications as prescribed.' },
  { keys: ['ecg', 'ekg', 'electrocardiogram', 'heart test'], response: '📊 An ECG records your heart\'s electrical activity. It detects arrhythmias, heart attacks, and other conditions. Your doctor can order one during your consultation.' },
  { keys: ['echo', 'echocardiogram', 'ultrasound heart'], response: '🔊 An echocardiogram uses ultrasound to visualize heart structure and function. It assesses valves, chambers, and pumping efficiency. Ask your doctor if you need one.' },
  { keys: ['angiography', 'angiogram', 'coronary angiography'], response: '🔬 Coronary angiography is a procedure to visualize coronary arteries using contrast dye. It helps diagnose blockages. Your cardiologist will advise if needed.' },
  { keys: ['stent', 'angioplasty', 'bypass', 'cabg'], response: '🏥 Stenting/angioplasty opens blocked arteries. Bypass surgery creates new routes for blood flow. These are performed when arteries are significantly blocked. Discuss with Dr. Ravikant Patil.' },
  // Medications
  { keys: ['aspirin', 'ecosprin'], response: '💊 Aspirin (75-325mg) is used to prevent blood clots. Take with food to avoid stomach upset. Do not stop without consulting your doctor.' },
  { keys: ['beta blocker', 'metoprolol', 'atenolol', 'bisoprolol'], response: '💊 Beta-blockers slow heart rate and reduce blood pressure. Take as prescribed. Do not stop suddenly — taper under doctor supervision.' },
  { keys: ['statin', 'atorvastatin', 'rosuvastatin', 'lipitor'], response: '💊 Statins lower LDL cholesterol. Take at night for best effect. Report muscle pain to your doctor immediately.' },
  { keys: ['blood thinner', 'warfarin', 'clopidogrel', 'anticoagulant', 'plavix'], response: '💊 Blood thinners prevent clots. Regular INR monitoring needed for warfarin. Avoid NSAIDs. Report unusual bleeding to your doctor.' },
  { keys: ['nitroglycerin', 'nitrate', 'sorbitrate'], response: '💊 Nitroglycerin relieves angina. Place under tongue during chest pain. If pain persists after 3 doses (5 min apart), call 108.' },
  // Lifestyle
  { keys: ['diet', 'food', 'eat', 'nutrition', 'cardiac diet'], response: '🥗 Cardiac diet: Eat fruits, vegetables, whole grains, lean protein, fish. Limit salt (<2g/day), saturated fats, sugar, and processed foods. Mediterranean diet is recommended.' },
  { keys: ['exercise', 'workout', 'physical activity', 'walk'], response: '🏃 Exercise 30 min/day, 5 days/week. Walking, swimming, cycling are ideal. Start slow if recovering. Avoid heavy lifting without clearance. Stop if chest pain occurs.' },
  { keys: ['smoking', 'cigarette', 'tobacco', 'quit smoking'], response: '🚭 Smoking doubles cardiac risk. Quitting reduces risk within 1 year. Ask your doctor about nicotine replacement therapy or medications to help quit.' },
  { keys: ['alcohol', 'drinking', 'wine', 'beer'], response: '🍷 Limit alcohol: max 1 drink/day for women, 2 for men. Excessive alcohol causes cardiomyopathy and arrhythmias. Avoid if on blood thinners.' },
  { keys: ['stress', 'anxiety', 'mental health', 'depression'], response: '🧘 Chronic stress raises blood pressure and cardiac risk. Practice meditation, yoga, deep breathing. Seek mental health support if needed. Sleep 7-8 hours nightly.' },
  { keys: ['weight', 'obesity', 'bmi', 'overweight'], response: '⚖️ Healthy BMI: 18.5-24.9. Losing even 5-10% of body weight significantly reduces cardiac risk. Combine diet and exercise. Consult your doctor for a plan.' },
  // App navigation
  { keys: ['appointment', 'book', 'schedule', 'consultation', 'request chat'], response: '📅 To book an appointment: Go to the Appointments tab → tap "Request Chat" or "Request Video" → Admin will approve and assign a doctor → you\'ll get a 30-min session.' },
  { keys: ['report', 'upload', 'medical record'], response: '📄 Your medical reports are in the History tab. Your doctor can upload reports during consultations. Contact your doctor via the Appointments tab to request report uploads.' },
  { keys: ['doctor', 'my doctor', 'assigned doctor'], response: '👨‍⚕️ Your assigned doctor is shown on your Home screen. You can chat with them through an approved appointment session in the Appointments tab.' },
  { keys: ['emergency', 'urgent', 'help'], response: '🚨 For emergencies: Use the Emergency button on your Home screen to alert your doctor and admin. Or call 108 (Hospital), 102 (Ambulance), 100 (Police) from your Profile tab.' },
  { keys: ['logout', 'sign out'], response: '🚪 To logout: Go to the Profile tab → tap the Logout button → confirm.' },
  { keys: ['password', 'forgot password', 'reset'], response: '🔑 To reset your password: Go to the Login screen → tap "Forgot password?" → enter your email → follow the reset link sent to your email.' },
  // Greetings
  { keys: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'namaste'], response: '👋 Hello! I\'m your cardiac health assistant for Dr. Ravikant Patil\'s Tele Patient System. Ask me about symptoms, medications, diet, or how to use the app!' },
  { keys: ['thank', 'thanks', 'thank you', 'dhanyawad'], response: '😊 You\'re welcome! Stay healthy and take care of your heart. Remember — regular check-ups save lives! 🫀' },
  { keys: ['bye', 'goodbye', 'see you'], response: '👋 Goodbye! Take care of your heart health. Remember to take your medications on time and follow up with Dr. Ravikant Patil regularly. 🫀' },
  { keys: ['who are you', 'what are you', 'chatbot', 'bot', 'ai'], response: '🤖 I\'m the AI Health Assistant for Dr. Ravikant Patil\'s Tele Patient System. I can help with cardiac health questions, medication info, lifestyle advice, and app navigation. I\'m not a replacement for your doctor!' },
];

// ─── Smart Response Engine ────────────────────────────────────────────────────
function getResponse(message) {
  const msg = message.toLowerCase().trim();

  // Check knowledge base
  for (const entry of KB) {
    if (entry.keys.some(k => msg.includes(k))) {
      return entry.response;
    }
  }

  // Number detection (vitals)
  if (/\d+\/\d+/.test(msg)) {
    return '🩺 I see you\'ve shared a reading. For accurate interpretation of your vitals, please share them with Dr. Ravikant Patil during your consultation. Book an appointment via the Appointments tab.';
  }

  // Default
  return '🤔 I\'m not sure about that specific question. For medical advice, please consult Dr. Ravikant Patil directly through the Appointments tab. For emergencies, call 108 immediately.\n\nYou can ask me about:\n• Cardiac symptoms\n• Medications\n• Diet & lifestyle\n• How to use the app';
}

// POST /api/chatbot/message
router.post('/message', protect, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: 'Message is required' });

    const response = getResponse(message);
    res.json({
      response,
      timestamp: new Date(),
      isBot: true,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
