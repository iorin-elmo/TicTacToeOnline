import React from 'react';
import Board from './Board'; // Boardコンポーネントをインポート

// GameState 型の定義 (App.tsx と同じもの)
interface GameState {
    board: (string | null)[];
    currentTurn: string; // 'X' or 'O' - プロパティ名を currentPlayer から currentTurn に変更
    winner: string | null;
    isDraw: boolean;
    players: { [key: string]: string }; // { connectionId: 'X' or 'O' }
    playerX_ConnectionId: string | null;
    playerO_ConnectionId: string | null;
}

interface GameProps {
    gameState: GameState;
    playerSymbol: string; // 'X' or 'O'
    roomName: string;
    onMakeMove: (index: number) => Promise<void>;
    onResetGame: () => Promise<void>;
    onLeaveRoom: () => Promise<void>;
}

const Game: React.FC<GameProps> = ({
    gameState,
    playerSymbol,
    roomName,
    onMakeMove,
    onResetGame,
    onLeaveRoom
}) => {

    const { board, currentTurn, winner, isDraw, players, playerX_ConnectionId, playerO_ConnectionId } = gameState;

    // プレイヤー数を計算
    const playerCount = Object.keys(players).length;
    const opponentConnected = (playerSymbol === 'X' && playerO_ConnectionId) || (playerSymbol === 'O' && playerX_ConnectionId);

    let status;
    if (winner) {
        status = `勝者: ${winner}`;
    } else if (isDraw) {
        status = "引き分け";
    } else if (playerCount < 2 || !opponentConnected) {
         status = "対戦相手の接続を待っています...";
    } else {
        status = `次のプレイヤー: ${currentTurn}`;
    }

    const isMyTurn = currentTurn === playerSymbol && playerCount === 2 && !winner && !isDraw;
    const canReset = (winner || isDraw) && playerCount === 2; // 勝敗が決まったらリセット可能（両方いる場合）

    const handleSquareClick = (index: number) => {
        if (isMyTurn && board[index] === null) {
            onMakeMove(index);
        }
    };

    return (
        <div className="game">
            <h2>部屋: {roomName}</h2>
            <p>あなたは {playerSymbol} です。</p>
             {playerCount < 2 && <p style={{ fontStyle: 'italic' }}>対戦相手を待っています...</p>}
            <div className="game-board">
                <Board squares={board} onClick={handleSquareClick} />
            </div>
            <div className="game-info">
                <div>{status}</div>
                {/* リセットボタンは勝敗が決まった後、または両プレイヤーがいる場合に表示するなどの調整が可能 */}
                <button onClick={onResetGame} disabled={!canReset}>
                    ゲームをリセット
                </button>
                <button onClick={onLeaveRoom}>部屋を退出</button>
            </div>
             {/* デバッグ用情報 */}
            {/* <pre style={{ fontSize: '0.8em', textAlign: 'left', background: '#eee', padding: '5px' }}>
                Debug Info:
                My Turn: {isMyTurn ? 'Yes' : 'No'}
                Can Reset: {canReset ? 'Yes' : 'No'}
                Player Count: {playerCount}
                Opponent Connected: {opponentConnected ? 'Yes' : 'No'}
                GameState: {JSON.stringify(gameState, null, 2)}
            </pre> */}
        </div>
    );
};

export default Game;