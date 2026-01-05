const { db } = require('./firebase-config.js');
const { collection, addDoc, serverTimestamp } = require('firebase/firestore');

async function sendFeedback(feedbackData) {
  try {
    const docRef = await addDoc(collection(db, "feedbacks"), {
      type: feedbackData.type,
      content: feedbackData.content,
      appVersion: "1.0.0",
      os: window.navigator.platform,
      createdAt: serverTimestamp(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error };
  }
}

module.exports = { sendFeedback };