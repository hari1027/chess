import {Chess} from 'chess.js'
import {BehaviorSubject} from 'rxjs'
import {map} from 'rxjs/operators'
import {auth, db} from './firebase'
import {fromRef} from 'rxfire/firestore'

let gameRef
let member
const chess = new Chess()
export let gameSubject 

export async function initGame(gameRefFb){
    const {currentUser} = auth
    if(gameRefFb){
        gameRef = gameRefFb
       const initialGame = await gameRefFb.get().then(doc => doc.data()) 
       if(!initialGame){
         return 'notfound'
       }
       const creator = initialGame.members.find(m => m.creator === true)

       if(initialGame.status === "waiting" && creator.uid !== currentUser.uid && initialGame.isBot !== true){
          const currUser = {
            uid : currentUser.uid,
            name : localStorage.getItem('userName'),
            piece : creator.piece === 'w' ? 'b' : 'w'
          }
          const updatedMembers = [...initialGame.members, currUser]
          await gameRefFb.update({members: updatedMembers , status: 'ready'})
       } 
       else if(initialGame.status === "waiting" && initialGame.isBot === true){
        const currUser = {
            uid : "BOTID",
            name : "Bot",
            piece : creator.piece === 'w' ? 'b' : 'w'
          }
          const updatedMembers = [...initialGame.members, currUser]
          await gameRefFb.update({members: updatedMembers , status: 'ready'})
       }
       else if(!initialGame.members.map(m => m.uid).includes(currentUser.uid)){
           return "intruder"
       }
       chess.reset()
       gameSubject = fromRef(gameRefFb).pipe(
        map(gameDoc => {
            const game = gameDoc.data()
            const {pendingPromotion, gameData, ...restOfGame} = game || {}
            member = game.members.find(m => m.uid === currentUser.uid)
            const oponent = game.members.find(m => m.uid !== currentUser.uid)

            if(gameData){
                chess.load(gameData)
            }
            const isGameOver = chess.isGameOver()
            return{
                board: chess.board(),
                pendingPromotion,
                isGameOver,
                position: member.piece,
                member,
                oponent,
                result : isGameOver ? getGameResult() : null,
                whiteTimer : "30:00",
                blackTimer : "30:00",
                ...restOfGame
            }
        })
       )

    } else{
       gameRef = null
       gameSubject = new BehaviorSubject()
       const savedGame = localStorage.getItem('savedGame')
       if(savedGame){
         chess.load(savedGame)
        }
       updateGame()
    }
}

export async function resetGame(){
    if(gameRef){
        await updateGame(null, true)
        chess.reset()
    } else {
        chess.reset()
        updateGame()
    }
}

export function handleMove(from , to ){
    const promotions = chess.moves({verbose:true}).filter(m => m.promotion)
    let pendingPromotion

    if(promotions.some(p => `${p.from}:${p.to}` === `${from}:${to}`)){
        pendingPromotion = {from , to , color:promotions[0].color}
        updateGame(pendingPromotion)
    }
    if(!pendingPromotion){
        move(from,to)
    }
}

export function move(from , to , promotion){
    try {
        let tempMove = { from , to }
        if(promotion){
            tempMove.promotion = promotion
        }
        if(gameRef){
           if(member.piece === chess.turn()){
            const legalMove = chess.move(tempMove);
            if (legalMove) {
                updateGame()
            } else {
              console.log(`Illegal move attempted: ${JSON.stringify({ from, to })}`);
            }
           }
        } else {
            const legalMove = chess.move(tempMove);
            if (legalMove) {
                updateGame()
            } else {
              console.log(`Illegal move attempted: ${JSON.stringify({ from, to })}`);
            }
        }
      } catch (error) {
        console.error('Error processing move:', error);
      }
}

export async function updateGame(pendingPromotion, reset , request , restart){
    const isGameOver = chess.isGameOver()
    if(gameRef){
        const updatedData = { gameData: restart ? null : chess.fen(), pendingPromotion: pendingPromotion || null, request: request || null }
        if (reset) {
            updatedData.status = "over"
        }
        if(restart){
            updatedData.status = "ready"
            updatedData.updateTimer = true
            updatedData.whiteTimer = "30:00"
            updatedData.blackTimer = "30:00"
        }
        await gameRef.update(updatedData)
    } else {
        const newGame = {
            board: chess.board(),
            pendingPromotion,
            isGameOver,
            position: chess.turn(),
            result : isGameOver ? getGameResult() : null
        }
        localStorage.setItem('savedGame' , chess.fen())
        gameSubject.next(newGame)
    }
}

function getGameResult(){
    if(chess.isCheckmate()){
        const winner = chess.turn() === "w" ? 'BLACK' : 'WHITE'
        return `CHECKMATE - WINNER - ${winner}`
    } else if(chess.isDraw()){
        let reason = '50 - MOVES - RULE'
        if(chess.isStalemate){
            reason = 'STALEMATE'
        } else if(chess.isThreefoldRepetition()){
            reason = 'REPETITION'
        } else if(chess.isInsufficientMaterial()){
            reason = 'INSUFFICIENT MATERIAL'
        }
        return `Draw - ${reason}`
    } else {
        return 'UNKNOWN REASON'
    }
}

export async function forfeitGame() {
    try {
        const winner = member.piece === "w" ? "BLACK" : "WHITE";
        const result = `FORFEIT - WINNER - ${winner}`;
        if (gameRef) {
            await gameRef.update({
                status: "over",
                result: result,
                gameData: null,
                pendingPromotion:null,
                isGameOver:true
            });
        }
    } catch (error) {
        console.error("Error handling forfeit:", error);
    }
}

export async function acceptRequest(game , setWhiteTimer , setBlackTimer) {
    gameRef = db.doc(`games/${game.gameId}`)

    if(game.isBot){
        if (gameRef) {
            await updateGame(null , false , null , true )
            chess.reset();               
            updateGame(); 
            setBlackTimer("30:00")
            setWhiteTimer("30:00")
        }
    } else {

      const currentRequest = game.request;

      if (!currentRequest) {
        console.error("No active request.");
          return;
      }

      if (currentRequest.type === "draw") {
        if (gameRef) {
            await gameRef.update({ 
                 status: "over",
                 result: "BOTH - AGGRED - TO - DRAW" ,
                 gameData: null,
                 pendingPromotion: null,
                 isGameOver:true 
            });
        }
      } else if (currentRequest.type === "restart") {
        if (gameRef) {
            await updateGame(null , false , null , true )
            chess.reset();               
            updateGame(); 
        }
      } 
    }

    if (gameRef && !game.isBot) {
        await gameRef.update({ request: null });
    } 
}


export async function rejectRequest() {
    if (gameRef) {
        await gameRef.update({ request: null });
    } 
}

export function whosMove(){
    return chess.turn()
}

export function changeUpdateTime(){ 
    gameRef.update({ updateTimer: false });
}

export async function gameOverByTime(winner){
    try {
        const result = `WINNER - ${winner}`;
        if (gameRef) {
            await gameRef.update({
                status: "over",
                result: result,
                gameData: null,
                pendingPromotion:null,
                isGameOver:true
            });
        }
    } catch (error) {
        console.error("Error handling forfeit:", error);
    }
}

// export async function makeBotMove (game) {
//     if (game.isGameOver || game.request || game.result || !game.isBot || whosMove() !== game.oponent.piece) return; 
  
//     const moves = chess.moves({ verbose: true });
//     if (moves.length === 0) return;
  
//     const move = moves[Math.floor(Math.random() * moves.length)];
//     const { from, to, promotion } = move;
//     console.log(`Bot attempting move: ${JSON.stringify(move)}`);

//   if (chess.move({ from, to, promotion })) {
//     updateGame();
//   } else {
//     console.log(`Bot attempted an illegal move: ${JSON.stringify({ from, to })}`);
//   }
// };

export async function makeBotMove(game) {
    if (game.isGameOver || game.request || game.result || !game.isBot || whosMove() !== game.oponent.piece) return;

    const fen = chess.fen(); // Get current board position in FEN format
    const stockfishAPI = "https://stockfish.online/api/s/v2.php";

    try {
        const response = await fetch(`${stockfishAPI}?fen=${encodeURIComponent(fen)}&depth=15`);
        const data = await response.json();

        if (data && data.success && data.bestmove) {
            const bestMoveString = data.bestmove; 

            // Extract the actual move from the string
            const moveParts = bestMoveString.split(" ");
            if (moveParts.length < 2) {
                console.error("Invalid best move format:", bestMoveString);
                return;
            }

            const bestMove = moveParts[1]; 
            const from = bestMove.substring(0, 2);
            const to = bestMove.substring(2, 4);
            const promotion = bestMove.length === 5 ? bestMove[4] : undefined;

            console.log(`Bot moving: ${from} -> ${to} (Promotion: ${promotion || "none"})`);

            if (chess.move({ from, to, promotion })) {
                updateGame();
            } else {
                console.log(`Bot attempted an illegal move: ${from} -> ${to}`);
            }
        } else {
            console.error("Invalid response from Stockfish API", data);
        }
    } catch (error) {
        console.error("Error fetching move from Stockfish API:", error);
    }
}
