import React,{useState} from 'react'
import {auth ,db} from './firebase'
import { useNavigate } from 'react-router-dom';

export default function Home(){
    const navigate = useNavigate();
    const {currentUser} = auth
    const [showModal , setShowModal] = useState(false)
    const newGameOptions=[
        {label: 'Black pieces', value: 'b'},
        {label: 'White pieces', value: 'w'},
        {label: 'Random', value: 'r'}
    ]
    const [Isbot,setIsBot] = useState(false)

    function handlePlayOnlineOrWithBot (playwithbot){
        setShowModal(true)
        if(playwithbot){
          setIsBot(true)
        }
    }

    async function startOnlineGameOrWithBot(staringPiece){
          const member = {
            uid: currentUser.uid,
            piece: staringPiece === 'r' ? ['b','w'][Math.round(Math.random())] : staringPiece,
            name: localStorage.getItem('userName') || 'Unknown',
            creator:true
          }
          const game ={
            status: 'waiting',
            members:[member],
            gameId: `${Math.random().toString(36).substr(2,9)}_${Date.now()}`,
            whiteTimer:"30:00",
            blackTimer:"30:00",
            isBot:Isbot
          }
          await db.collection('games').doc(game.gameId).set(game)
          navigate(`/game/${game.gameId}`);
    }

    function startLocalGame() {
        navigate('/game/local');
    }

    return (
        <>
        <div className='columns home'>
            <div className='column has-background-primary home-columns'>
                 <button className="button is-link" onClick={startLocalGame}>
                    Play with Yourself
                 </button>
            </div>
            <div className='column has-background-link home-columns'>
                  <button className="button is-primary" onClick={() => handlePlayOnlineOrWithBot(false)}>
                     Play with your friend
                  </button>
            </div>
            <div className='column has-background-primary home-columns'>
                 <button className="button is-link" onClick={() => handlePlayOnlineOrWithBot(true)}>
                    Play with bot
                 </button>
            </div>
            <div className={`modal ${showModal ? 'is-active': ''}`}>
                <div className="modal-content">
                    <div className="card">
                        <div className="card-content">
                            <div className='content'>
                               Please select the piece you want to start
                            </div>
                        </div>
                        <footer className="card-footer">
                           {newGameOptions.map(({label,value})=>(
                             <span className="card-footer-item pointer" key={value} onClick={() => startOnlineGameOrWithBot(value)}>
                               {label}
                             </span>
                             ))}
                        </footer>
                    </div>
                </div>
                   <button className="modal-close is-large" onClick={() => setShowModal(false)}></button>
            </div>
        </div>
        </>
    )
}