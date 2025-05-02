import { useState, useEffect, useCallback } from 'react';
import * as signalR from "@microsoft/signalr";
import Lobby from './components/Lobby';
import Game from './components/Game';
import './App.css';

// GameState 型の定義 (サーバー側の Models/GameState.cs に合わせる)
interface GameState {
    board: (string | null)[];
    currentTurn: string; // 'X' or 'O' - プロパティ名を currentPlayer から currentTurn に変更
    winner: string | null;
    isDraw: boolean;
    players: { [key: string]: string }; // { connectionId: 'X' or 'O' }
    playerX_ConnectionId: string | null;
    playerO_ConnectionId: string | null;
}

// Error State 型の定義
interface AppError {
    message: string;
    type?: 'room_full' | 'invalid_move' | 'other'; // エラータイプを追加
}

function App() {
    const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
    const [rooms, setRooms] = useState<string[]>([]);
    const [currentRoom, setCurrentRoom] = useState<string | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [playerSymbol, setPlayerSymbol] = useState<string | null>(null); // 'X' or 'O'
    const [error, setError] = useState<AppError | null>(null); // error ステートの型を変更

    // SignalR接続の初期化とイベントハンドラの設定
    useEffect(() => {
        const newConnection = new signalR.HubConnectionBuilder()
            .withUrl("http://localhost:5888/gamehub", {
              transport: signalR.HttpTransportType.WebSockets,
              withCredentials: true
            })// APIのURLを確認してください
            //.configureLogging(signalR.LogLevel.None)
            .build();

        setConnection(newConnection);

        newConnection.start()
            .then(() => {
                console.log('SignalR Connected.');
                // 接続後に部屋リストを取得
                newConnection.invoke("GetRooms").catch(err => console.error("GetRooms failed: ", err));
            })
            .catch(e => console.log('Connection failed: ', e));

        // サーバーからのメッセージハンドラ
        newConnection.on("ReceiveRooms", (updatedRooms: string[]) => {
            setRooms(updatedRooms);
        });

        newConnection.on("ReceiveGameState", (stateFromServer: any) => { // Use 'any' temporarily or define a server-specific type
            console.log("ReceiveGameState (raw):", stateFromServer);
            // Flatten the 2D board from the server into a 1D array
            // Ensure stateFromServer.board exists and is an array before flattening
            const flattenedBoard = Array.isArray(stateFromServer?.board)
                ? stateFromServer.board.flat().map((cell: string) => cell === '' ? null : cell)
                : Array(9).fill(null); // Default to empty board if data is invalid

            const clientState: GameState = {
                ...stateFromServer,
                board: flattenedBoard, // Use the flattened board
            };
            console.log("ReceiveGameState (processed):", clientState);
            setGameState(clientState);
            setError(null);
        });

        newConnection.on("AssignSymbol", (symbol: string) => {
            console.log("Assigned Symbol:", symbol);
            setPlayerSymbol(symbol);
        });

        newConnection.on("ReceiveError", (errorMessage: string) => {
            console.error("Server Error:", errorMessage);
            let errorType: AppError['type'] = 'other';
            if (errorMessage.includes("full")) {
                errorType = 'room_full';
            } else if (errorMessage.includes("Invalid move")) {
                errorType = 'invalid_move';
            }
            setError({ message: errorMessage, type: errorType }); // error オブジェクトをセット
        });

        // クリーンアップ関数
        return () => {
            newConnection.stop();
        };
    }, []); // 初回レンダリング時のみ実行

    // エラーをクリアする関数（ロビーに戻る処理を追加）
    const clearError = useCallback(() => {
        if (error?.type === 'room_full') {
            // 満員エラーの場合はロビーに戻る
            setCurrentRoom(null);
            setGameState(null);
            setPlayerSymbol(null);
        }
        setError(null); // エラーメッセージ自体は常にクリア
    }, [error]); // error を依存配列に追加

    // 部屋作成処理
    const handleCreateRoom = useCallback(async (roomName: string) => {
        clearError();
        if (connection) {
            try {
                await connection.invoke("CreateRoom", roomName);
                // CreateRoom成功後、サーバーからのAssignSymbolとReceiveGameStateで状態が更新されるのを待つ
                // 即座に部屋名をセットする（サーバー側で参加処理が完了するため）
                setCurrentRoom(roomName);
            } catch (err) {
                console.error("CreateRoom failed: ", err);
                setError({ message: "部屋の作成に失敗しました。", type: 'other' });
            }
        }
    }, [connection, clearError]);

    // 部屋参加処理
    const handleJoinRoom = useCallback(async (roomName: string) => {
        setError(null); // Clear previous error before attempting join
        if (connection) {
            try {
                // JoinRoom を呼び出す前に setCurrentRoom しない
                await connection.invoke("JoinRoom", roomName);
                // JoinRoom 成功後、サーバーからの AssignSymbol と ReceiveGameState で状態が更新されるのを待つ
                // 成功した場合のみ部屋名をセット
                setCurrentRoom(roomName);
            } catch (err) {
                console.error("JoinRoom failed: ", err);
                // エラーは ReceiveError ハンドラで処理されるため、ここでは setError しない
            }
        }
    }, [connection]);

    // 手を打つ処理
    const handleMakeMove = useCallback(async (index: number) => {
        clearError();
        if (connection && currentRoom && gameState) {
            const myTurn = (playerSymbol === 'X' && gameState.currentTurn === 'X') ||
                           (playerSymbol === 'O' && gameState.currentTurn === 'O');
            if (!myTurn) {
                setError({ message: "相手のターンです。", type: 'invalid_move' });
                return;
            }
            // gameState.board は既に 1次元配列のはず
            // Add bounds check for index
            if (index < 0 || index >= gameState.board.length || gameState.board[index] !== null) {
                setError({ message: "無効なマスか、既に置かれています。", type: 'invalid_move' });
                return;
            }
             if (gameState.winner || gameState.isDraw) {
                setError({ message: "ゲームは終了しています。", type: 'other' });
                return;
            }

            try {
                await connection.invoke("MakeMove", currentRoom, index);
            } catch (err) {
                console.error("MakeMove failed: ", err);
                setError({ message: "手の送信に失敗しました。", type: 'other' });
            }
        }
    }, [connection, currentRoom, playerSymbol, gameState, clearError]);

    // ゲームリセット処理
    const handleResetGame = useCallback(async () => {
        clearError();
        if (connection && currentRoom) {
            try {
                await connection.invoke("ResetGame", currentRoom);
            } catch (err) {
                console.error("ResetGame failed: ", err);
                setError({ message: "ゲームのリセットに失敗しました。", type: 'other' });
            }
        }
    }, [connection, currentRoom, clearError]);

    // 部屋退出処理
    const handleLeaveRoom = useCallback(async () => {
        clearError();
        if (connection && currentRoom) {
            try {
                await connection.invoke("LeaveRoom", currentRoom);
            } catch (err) {
                console.error("LeaveRoom failed: ", err);
                // 失敗してもクライアント側では部屋を出たことにする
            } finally {
                setCurrentRoom(null);
                setGameState(null);
                setPlayerSymbol(null);
                // ロビーに戻ったら部屋リストを再取得
                connection?.invoke("GetRooms").catch(err => console.error("GetRooms failed after leaving: ", err));
            }
        }
    }, [connection, currentRoom, clearError]);


    return (
        <div className="App">
            <h1>三目並べオンライン</h1>

            {!currentRoom ? (
                // ロビー画面
                <Lobby
                    connection={connection}
                    rooms={rooms}
                    handleCreateRoom={handleCreateRoom}
                    handleJoinRoom={handleJoinRoom}
                    // ロビーでのエラー表示 (もしあれば)
                    error={error && !currentRoom ? error.message : null}
                />
            ) : error ? (
                // 部屋関連のエラー表示
                <div style={{ color: 'red' }}>
                    <p>エラー: {error.message}</p>
                    {/* ボタンテキストを「ロビーに戻る」に変更 */}
                    <button onClick={clearError}>ロビーに戻る</button>
                </div>
            ) : gameState && playerSymbol ? (
                // ゲーム画面 (エラーがなく、ゲーム状態が準備完了)
                <Game
                    gameState={gameState}
                    playerSymbol={playerSymbol}
                    roomName={currentRoom}
                    onMakeMove={handleMakeMove}
                    onResetGame={handleResetGame}
                    onLeaveRoom={handleLeaveRoom}
                    // Game コンポーネント内のエラー表示は削除または調整可能
                    // error={null} // Game内ではエラー表示しない場合
                    // clearError={() => {}} // Game内ではエラークリア不要な場合
                    error={error} // Game内でもエラー表示する場合 (ただし、上のエラー表示と重複する可能性)
                    clearError={clearError} // Game内でもエラークリアする場合
                />
            ) : (
                // 接続中メッセージ (エラーがなく、ゲーム状態がまだ準備できていない)
                <p>部屋 '{currentRoom}' に接続中...</p>
            )}
        </div>
    );
}

export default App;
