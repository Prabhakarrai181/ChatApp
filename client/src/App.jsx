import React, { useContext } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import ProfilePage from './pages/ProfilePage'
import {Toaster} from "react-hot-toast"
import { AuthContext } from '../context/AuthContext'

const App = () => {
  const { incomingCallData, setIncomingCallData, allUsers } = useContext(AuthContext);

{incomingCallData && (
  <VideoCall
    selectedUser={allUsers.find(u => u._id === incomingCallData.from)}
    incomingCall={true}
    incomingOffer={incomingCallData.offer}
    onClose={() => setIncomingCallData(null)}
  />
)}
  const { authUser } = useContext(AuthContext)
  return (
    <div className="bg-[url('/bgImage.svg')] bg-contain"> 
      <Toaster/>
      <Routes>
        <Route path='/' element={authUser ? <HomePage /> : <Navigate to="/login" />}/>
        <Route path='/login' element={!authUser ? <LoginPage /> : <Navigate to="/" />}/>
        <Route path='/profile' element={authUser ? <ProfilePage /> : <Navigate to="/login" />}/>
      </Routes>
    </div>
  )
}

export default App
