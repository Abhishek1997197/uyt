import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAKIrhtXJoeIBHVfc1btxUoMcaIIjae5fE",
  authDomain: "kidsclub-ed1d7.firebaseapp.com",
  projectId: "kidsclub-ed1d7",
  storageBucket: "kidsclub-ed1d7.firebasestorage.app",
  messagingSenderId: "933800693768",
  appId: "1:933800693768:web:6c07210befbbf362e781bd",
  measurementId: "G-KDKC0QM30Q"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const socket = io("http://localhost:3001");

export default function Game() {
  const [user, setUser] = useState(null);
  const [players, setPlayers] = useState([]);
  const [currentImage, setCurrentImage] = useState(null);
  const [options, setOptions] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [scoreboard, setScoreboard] = useState([]);
  const [audioStream, setAudioStream] = useState(null);
  const [gameTimer, setGameTimer] = useState(30);
  
  useEffect(() => {
    signInAnonymously(auth).then((userCredential) => {
      setUser(userCredential.user);
      socket.emit("joinGame", userCredential.user.uid);
    });

    socket.on("updatePlayers", (players) => setPlayers(players));
    socket.on("newImage", ({ image, options }) => {
      setCurrentImage(image);
      setOptions(shuffleArray(options));
      setGameTimer(30);
    });
    socket.on("updateScoreboard", (scores) => setScoreboard(scores));
    socket.on("gameTimer", (time) => setGameTimer(time));

    const chatQuery = query(collection(db, "chat"), orderBy("timestamp"));
    const unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
      setChatMessages(snapshot.docs.map((doc) => doc.data()));
    });

    return () => unsubscribeChat();
  }, []);

  const shuffleArray = (array) => {
    return array.sort(() => Math.random() - 0.5);
  };

  const sendMessage = async () => {
    if (message.trim()) {
      const sanitizedMessage = message.replace(/badword|anotherbadword/gi, "***");
      await addDoc(collection(db, "chat"), {
        user: user.uid,
        text: sanitizedMessage,
        timestamp: new Date(),
      });
      setMessage("");
    }
  };

  const startVoiceChat = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      socket.emit("startVoice", { userId: user.uid });
    } catch (error) {
      console.error("Error accessing microphone", error);
    }
  };

  const stopVoiceChat = () => {
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
      socket.emit("stopVoice", { userId: user.uid });
    }
  };

  return (
    <div className="game-container">
      <h1>Image Identification Game</h1>
      <div className="players">Players: {players.length}/4</div>
      <div className="game-timer">Time Left: {gameTimer}s</div>
      {currentImage && (
        <div className="image-box">
          <img src={currentImage} alt="Game" />
          <div className="options">
            {options.map((option, index) => (
              <button key={index} onClick={() => socket.emit("answer", { userId: user.uid, answer: option })}>{option}</button>
            ))}
          </div>
        </div>
      )}
      <div className="scoreboard">
        <h2>Scoreboard</h2>
        <ul>
          {scoreboard.map((player, index) => (
            <li key={index}>{player.name}: {player.score} points</li>
          ))}
        </ul>
      </div>
      <div className="chat-box">
        <div className="messages">
          {chatMessages.map((msg, index) => (
            <p key={index}>{msg.text}</p>
          ))}
        </div>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
      <div className="voice-chat">
        {audioStream ? (
          <button onClick={stopVoiceChat}>Stop Voice Chat</button>
        ) : (
          <button onClick={startVoiceChat}>Start Voice Chat</button>
        )}
      </div>
    </div>
  );
}