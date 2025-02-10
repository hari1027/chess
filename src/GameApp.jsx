import React, {useEffect , useRef, useState} from 'react'
import './App.css';
import {acceptRequest, rejectRequest, forfeitGame, gameSubject, initGame, resetGame, updateGame, whosMove, gameOverByTime, changeUpdateTime, makeBotMove} from './Game'
import Board from './Board'
import {useParams , useNavigate} from 'react-router-dom'
import {auth, db} from './firebase'

function GameApp() {
  const navigate = useNavigate();
  const [board, setBoard] = useState([])
  const [isGameOver, setIsGameOver] = useState()
  const [result, setResult] = useState()
  const [position, setposition] = useState()
  const {id} = useParams()
  const [initResult , setInitResult] = useState(null)
  const [loading , setLoading] = useState(true)
  const [status , setStatus] = useState('')
  const [game , setGame] = useState({})
  const sharableLink = window.location.href

   const {currentUser} = auth
   const timerRef = useRef(null);

   const [whiteTimer, setWhiteTimer] = useState();
   const [blackTimer, setBlackTimer] = useState();

  useEffect(()=>{
    let subscribe
    
    async function init(){
       const res = await initGame(id !== 'local' ? db.doc(`games/${id}`) : null)
       setInitResult(res)
       setLoading(false)
       if(!res){
       subscribe = gameSubject.subscribe(game => {
       setBoard(game.board)
       setIsGameOver(game.isGameOver)
       setResult(game.result)
       setposition(game.position)
       setStatus(game.status)
       setGame(game)
       setWhiteTimer((prev) => (prev === undefined ? game.whiteTimer : prev));
       setBlackTimer((prev) => (prev === undefined ? game.blackTimer : prev));
       })
      }
   }

   init()
    return() => subscribe && subscribe.unsubscribe()
  }, [id])

  const timeStringToSeconds = (timeString) => {
    const [minutes, seconds] = timeString.split(":").map(Number);
    return minutes * 60 + seconds;
  };

  const secondsToTimeString = (totalSeconds) => {
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  const reduceTimers = () => {
    timerRef.current = setInterval(() => {
      if(whosMove() === 'b'){
        setBlackTimer((prev) => {
          const totalSeconds = timeStringToSeconds(prev);
          if (totalSeconds <= 0) {
            gameOverByTime("WHITE")
            clearInterval(timerRef.current);
            return "00:00"; 
          }
          return secondsToTimeString(totalSeconds - 1);
        });
      } else {
        setWhiteTimer((prev) => {
          const totalSeconds = timeStringToSeconds(prev);
          if (totalSeconds <= 0) {
            gameOverByTime("BLACK" )
            clearInterval(timerRef.current);
            return "00:00"; 
          }
          return secondsToTimeString(totalSeconds - 1);
        });
      }

    }, 1000);
  };

  useEffect(() => {
    if(game && game.member && game.oponent && !game.request){
       reduceTimers();
        return () => clearInterval(timerRef.current);
    }

    if(game && game.member && game.oponent ){
      getTimersAfterRestart()
    }

    async function getTimersAfterRestart(){
      const res = await initGame(db.doc(`games/${id}`))
      if(!res){
       gameSubject.subscribe(async game => {
      if(game.updateTimer === true && game.member && game.oponent ){
       setWhiteTimer(game.whiteTimer);
       setBlackTimer(game.blackTimer);
       changeUpdateTime()
       }
      })
      }
    }
    
    if(localStorage.getItem("whiteTimer") !== undefined) {
      localStorage.getItem("whiteTimer") !== null && setWhiteTimer(localStorage.getItem("whiteTimer"))
      localStorage.removeItem("whiteTimer")}
    if(localStorage.getItem("blackTimer") !== undefined) {
      localStorage.getItem("blackTimer") !== null && setBlackTimer(localStorage.getItem("blackTimer"))
      localStorage.removeItem("blackTimer")}

  }, [game , id ]);

  useEffect(()=>{
    if (game.isBot && game.oponent?.uid === "BOTID" && whosMove() === game.oponent.piece) {
     makeBotMove(game)
    }
  },[game])
    
  const handleUnload = async () => {
      localStorage.setItem("whiteTimer", whiteTimer)
      localStorage.setItem("blackTimer", blackTimer)
  };
  
  window.addEventListener("beforeunload", handleUnload);
  
  async function copyToClipboard(){
    await navigator.clipboard.writeText(sharableLink)
  }

  if(loading){
    return 'Loading...'
  }
  if(initResult === "notfound"){
    return 'Game not found'
  }
  if(initResult === "intruder"){
     return 'The game is already full'
  }

 return (
    <div className='app-container'>
      <div className='main-board-container'>

      {!game.request &&
        <div className='side-contents1'>
        {game.member && game.oponent && !isGameOver && !result && !game.isBot &&
           <button className='button'  style={{backgroundColor:"lightblue" , width:"150px" , color:"black"}} onClick={async()=>{
            await updateGame(null, false, { type: "draw", requester: game.member.uid });
           }}>
              Ask for Draw
           </button>
        }
        {game.member && game.oponent && !isGameOver && !result && !game.isBot &&
           <button className='button' style={{backgroundColor:"lightgreen" , width:"150px" , color:"black"}} onClick={async()=>{
            await updateGame(null, false, { type: "restart", requester: game.member.uid });
           }}>
             Ask for Restart
           </button>
        }
        {((!game.member && !game.oponent) || (game.isBot && !isGameOver && !result )) &&
           <button className='button' style={{backgroundColor:"lightgreen" , width:"150px" , color:"black"}} onClick={async() => {
             game.isBot ? acceptRequest(game , setWhiteTimer , setBlackTimer) : await resetGame();
           }}>
             Restart
           </button>
        }
        {game.member && game.oponent && !isGameOver && !result && !game.isBot &&
           <button className='button' style={{backgroundColor: "lightpink" , width:"150px" , color:"black"}} onClick={async()=>{
               await forfeitGame();
           }}>
              Forfeit
           </button>
        }
        {((!game.member && !game.oponent) || (game.isBot && !isGameOver && !result)) &&
           <button className='button' style={{backgroundColor:"lightpink" , width:"150px" , color:"black"}} onClick={async() => {
            await resetGame();
            navigate('/')
            }}>
              Exit
           </button>
        }
        </div>
      }

      {game.request && (game.request.requester !== currentUser.uid) && (
          <div className='side-contents1' style={{padding:"10px" , textWrap:"wrap" , textAlign:"center"}}>
             <h1 style={{fontWeight:"bold" , color:"white"}}>{`Opponent is asking for a  ${game.request.type}. Do you accept?`}</h1>
               <button className='button' style={{backgroundColor:"lightgreen" , color:"black"}} onClick={() => {acceptRequest(game)}}>Accept</button>
               <button className='button' style={{backgroundColor:"lightpink" , color:"black"}} onClick={rejectRequest}>Reject</button>
           </div>
      )}

      {game.request && (game.request.requester === currentUser.uid) && (
          <div className='side-contents1' style={{padding:"10px" , textWrap:"wrap" , textAlign:"center"}}>
              <h1 style={{fontWeight:"bold" , color:"white"}}> Waiting for the response from the Opponent for the request you have made </h1>
           </div>
      )}  

      {isGameOver && (
        <h2 className='vertical-text'>
          GAME OVER
        <button onClick={async() => {
            if(localStorage.getItem("whiteTimer") !== undefined) {
               localStorage.removeItem("whiteTimer")}
            if(localStorage.getItem("blackTimer") !== undefined) {
               localStorage.removeItem("blackTimer")}
            setWhiteTimer("30:00")
            setBlackTimer("30:00")
           await resetGame();
           navigate('/');
           }}>
          <span className='vertical-text'>
            NEW GAME
          </span>
        </button>
        </h2>
       )}

        <div className='board-container'>
          {game.oponent && game.oponent.name && <span className="tag is-link" style={{marginBottom:"5px"}}>{game.oponent.name}</span>}
            <Board board={board} position={position} isGameOver={isGameOver} game={game}/>
          {game.member && game.member.name && <span className="tag is-link" style={{marginTop:"5px"}}>{game.member.name}</span>}
        </div>

        {result && <p className='vertical-text'> {result}</p>}

        <div className='side-contents2'>
            {isGameOver !== true && game.member && game.oponent && <div style={{textAlign:"center" , fontWeight:"bold" , color : "red" , marginBottom : '20px'}}> {game.oponent.piece === 'b' ? blackTimer : whiteTimer} </div>}
            {isGameOver !== true && game.member && game.oponent && (whosMove() === 'b' ? <div className='move-text'> Black's turn </div> : <div className='move-text'> White's turn </div>)}
            {isGameOver !== true && !game.member && !game.oponent && (whosMove() === 'b' ? <div className='move-text'> Black's turn </div> : <div className='move-text'> White's turn </div>)}
            {isGameOver !== true && game.member && game.oponent && <div style={{textAlign:"center" , fontWeight:"bold" , color : "red" , marginTop:'20px'}}> {game.member.piece === 'w' ? whiteTimer : blackTimer }</div>}

        </div>

      </div>

      {status === "waiting" && !game.isBot &&(
        <div className="notification is-link share-game">
          <strong>
            Share this game to continue
          </strong>
        <br />
        <br />
        <div className="field has-addons">
          <div className='control is-expanded'>
            <input type="text" name="" id="" className='input' readOnly value={sharableLink}/>
          </div>
          <div className="control">
              <button className="button is-info" onClick={copyToClipboard}>Copy</button>
            </div>
        </div>
        </div>
      )}

    </div>
  );
}

export default GameApp;
