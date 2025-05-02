import React, { useState } from 'react';
import * as signalR from "@microsoft/signalr";

interface LobbyProps {
    connection: signalR.HubConnection | null;
    rooms: string[];
    handleCreateRoom: (roomName: string) => Promise<void>;
    handleJoinRoom: (roomName: string) => Promise<void>;
    error: string | null;
}

const Lobby: React.FC<LobbyProps> = ({ connection, rooms, handleCreateRoom, handleJoinRoom, error }) => {
    const [newRoomName, setNewRoomName] = useState<string>("");

    const onCreateRoom = () => {
        if (newRoomName) {
            handleCreateRoom(newRoomName);
            setNewRoomName(""); // Clear input after creation attempt
        }
    };

    const isConnected = connection?.state === signalR.HubConnectionState.Connected;

    return (
        <div>
            <h1>三目並べ - ロビー</h1>
            {error && <p style={{ color: "red" }}>{error}</p>}
            <h2>利用可能な部屋:</h2>
            {rooms.length === 0 ? (
                <p>現在、利用可能な部屋はありません。</p>
            ) : (
                <ul>
                    {rooms.map((room) => (
                        <li key={room}>
                            {room} <button onClick={() => handleJoinRoom(room)} disabled={!isConnected}>参加</button>
                        </li>
                    ))}
                </ul>
            )}
            <hr />
            <h2>新しい部屋を作成:</h2>
            <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="部屋名"
                disabled={!isConnected}
            />
            <button onClick={onCreateRoom} disabled={!newRoomName || !isConnected}>作成して参加</button>
        </div>
    );
};

export default Lobby;