import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCBGfeG3nyFlwfEz2WxuLgSIV-gWwZ9UZU",
  authDomain: "medcontrol-6a112.firebaseapp.com",
  projectId: "medcontrol-6a112",
  storageBucket: "medcontrol-6a112.firebasestorage.app",
  messagingSenderId: "965221067154",
  appId: "1:965221067154:web:096ddccebc9fefcf03794b",
  measurementId: "G-4V7XQNC5SK",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
