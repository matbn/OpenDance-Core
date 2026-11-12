# OpenDance Core

This project is the main game of OpenDance: a web session that displays the dance coach, plays the music and scores every player that joins with the [OpenDance Controller](https://github.com/matbn/OpenDance-Controller) phone app.

The server is Node.js (Express + ws) and the stage is React + Vite. Each choreography is a JSON file (song info + scored moves) paired with a full dance animation (keyframes JSON or BVH mocap) and an audio file.



```powershell

git clone https://github.com/matbn/OpenDance-Core.git

cd OpenDance-Core

cd web
npm install
npm run build

cd ../server
npm install
npm start
```



Open http://localhost:3001, create a room and pick a song; phones on the same network join with the controller app and find the server automatically. The server serves the built web stage, so `npm run build` in `web` is only needed again after changing it.

To add songs, export them from [OpenDance Creator](https://github.com/matbn/OpenDance-Creator) and drop the JSON in `choreographies/songs`, the audio in `server/audio` and the dance animation in `choreographies/dances`, all sharing the same file name.