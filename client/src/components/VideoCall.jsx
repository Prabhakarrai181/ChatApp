// client/src/components/VideoCall.jsx    

import React, { useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../../context/AuthContext";

const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const VideoCall = ({ selectedUser, onClose, incomingCall = false, incomingOffer = null }) => {
  const { authUser, socket } = useContext(AuthContext);
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingIceRef = useRef([]);
  const [incoming, setIncoming] = useState(incomingCall);
  const [callerName, setCallerName] = useState("");
  const [status, setStatus] = useState("Calling...");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const stopCall = (notify = true) => {
    if (notify && socket && selectedUser) {
      socket.emit("call-ended", { to: selectedUser._id });
    }
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    onClose();
  };

  const createPeer = (targetUserId) => {
    const pc = new RTCPeerConnection(rtcConfig);
    peerRef.current = pc;
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { to: targetUserId, candidate: event.candidate });
      }
    };
    pc.ontrack = (event) => {
      if (remoteVideo.current) remoteVideo.current.srcObject = event.streams[0];
      setStatus("Connected");
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
        setStatus("Call ended");
      }
    };
    return pc;
  };

  const getLocalStream = async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    if (localVideo.current) localVideo.current.srcObject = stream;
    return stream;
  };

  const addPendingIce = async (pc) => {
    for (const candidate of pendingIceRef.current) {
      try { await pc.addIceCandidate(candidate); } catch {}
    }
    pendingIceRef.current = [];
  };

  useEffect(() => {
    if (!socket || !selectedUser) return;

    const onIncoming = ({ from, offer, callerName: name }) => {
      if (from === selectedUser._id) {
        setCallerName(name || selectedUser.fullName);
        setIncoming(true);
        setStatus("Incoming video call");
      }
    };

    const onAnswered = async ({ answer }) => {
      if (!peerRef.current) return;
      await peerRef.current.setRemoteDescription(answer);
      await addPendingIce(peerRef.current);
      setStatus("Connected");
    };

    const onIce = async ({ candidate }) => {
      if (!candidate) return;
      const pc = peerRef.current;
      if (pc?.remoteDescription) {
        try { await pc.addIceCandidate(candidate); } catch {}
      } else {
        pendingIceRef.current.push(candidate);
      }
    };

    const onRejected = () => {
      setStatus("Call rejected");
      setTimeout(() => stopCall(false), 700);
    };

    const onEnded = () => stopCall(false);

    socket.on("incoming-call", onIncoming);
    socket.on("call-answered", onAnswered);
    socket.on("ice-candidate", onIce);
    socket.on("call-rejected", onRejected);
    socket.on("call-ended", onEnded);

    return () => {
      socket.off("incoming-call", onIncoming);
      socket.off("call-answered", onAnswered);
      socket.off("ice-candidate", onIce);
      socket.off("call-rejected", onRejected);
      socket.off("call-ended", onEnded);
    };
  }, [socket, selectedUser]);

  const startCall = async () => {
    try {
      const stream = await getLocalStream();
      const pc = createPeer(selectedUser._id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("call-user", {
        to: selectedUser._id,
        from: authUser._id,
        offer,
        callerName: authUser.fullName,
      });
      setStatus("Calling...");
    } catch (error) {
      alert("Camera/microphone permission is required for video calling.");
      stopCall(false);
    }
  };

  const acceptCall = async () => {
    try {
      const stream = await getLocalStream();
      const pc = createPeer(selectedUser._id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      if (!incomingOffer) return;
      await pc.setRemoteDescription(incomingOffer);
      await addPendingIce(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("call-answer", { to: selectedUser._id, answer });
      setIncoming(false);
      setStatus("Connecting...");
    } catch {
      setStatus("Unable to accept call");
    }
  };

  useEffect(() => {
    if (!incomingCall) startCall();
    return () => {
      peerRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-[#17132a] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
        <div className="px-4 py-3 flex items-center justify-between text-white">
          <div>
            <p className="font-medium">{selectedUser.fullName}</p>
            <p className="text-xs text-gray-400">{status}</p>
          </div>
          <button onClick={() => stopCall()} className="text-red-400 px-3 py-1 rounded-lg bg-white/5">End</button>
        </div>

        <div className="relative aspect-video bg-black">
          <video ref={remoteVideo} autoPlay playsInline className="w-full h-full object-cover" />
          <video ref={localVideo} autoPlay muted playsInline className="absolute right-3 top-3 w-32 sm:w-44 aspect-video object-cover rounded-xl border border-white/20 bg-black" />
          {incoming && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4 text-white">
              <p className="text-lg">{callerName || "Someone"} is calling...</p>
              <div className="flex gap-3">
                <button onClick={() => { socket.emit("call-rejected", { to: selectedUser._id }); stopCall(false); }} className="px-5 py-2 rounded-full bg-red-600">Reject</button>
                <button onClick={acceptCall} className="px-5 py-2 rounded-full bg-green-600">Accept</button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-3 p-4">
          <button onClick={() => {
            const tracks = localStreamRef.current?.getAudioTracks() || [];
            tracks.forEach(t => t.enabled = muted);
            setMuted(!muted);
          }} className="px-4 py-2 rounded-full bg-white/10 text-white">
            {muted ? "Unmute" : "Mute"}
          </button>
          <button onClick={() => {
            const tracks = localStreamRef.current?.getVideoTracks() || [];
            tracks.forEach(t => t.enabled = cameraOff);
            setCameraOff(!cameraOff);
          }} className="px-4 py-2 rounded-full bg-white/10 text-white">
            {cameraOff ? "Camera On" : "Camera Off"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
