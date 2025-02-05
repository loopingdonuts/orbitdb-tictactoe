import { useState } from "react";
import IPFS from "ipfs";
import OrbitDB from "orbit-db";

export default function useOrbitDB() {
  const [db, setDB] = useState(null);
  const [log, setLog] = useState([]);

  const getOrbit = async () => {
    const ipfs = await IPFS.create({
      repo: "ipfs/tic-tac-toe-looping-donuts/" + String(Math.random() + Date.now()),
      // repo: "dbticaaa",
      // EXPERIMENTAL: {
      //   pubsub: true,
      // },
      // config: {
      //   Addresses: {
      //     Swarm: ["/dns4/wrtc-star1.par.dwebops.pub/tcp/443/wss/p2p-webrtc-star"],
      //   },

      // },
    });

    return await OrbitDB.createInstance(ipfs);
  };

  const create = async name => {
    const orbit = await getOrbit();

    const db = await orbit.create("game", "eventlog", {
      accessController: {
        write: ["*"],
      },
      overwrite: true,
      replicate: true,
    });

    setDB(db);

    return new Promise((resolve, reject) => {
      db.add({
        type: "joined",
        data: {
          type: "host",
          name: name,
        },
      });

      db.events.on("replicated", () => {
        console.log("replicated");

        const result = db
          .iterator({ limit: -1 })
          .collect()
          .map(e => e.payload.value);
        setLog(result);

        if (result.length === 2) {
          resolve();
        }
      });

      db.events.on("write", (address, entry, heads) => {
        console.log("write", address, entry, heads);
        setLog(log => [...log, entry.payload.value]);
      });
    });
  };

  const join = async (name, id) => {
    const orbit = await getOrbit();

    console.log(orbit);

    const db = await orbit.open(id);
    setDB(db);

    console.log(db);
    console.log(name, id);

    db.events.on("write", (address, entry, heads) => {
      console.log("write", address, entry, heads);
    });

    console.log(
      db
        .iterator({ limit: -1 })
        .collect()
        .map(e => e.payload.value)
    );

    db.events.on("replicated", () => {
      console.log(
        db
          .iterator({ limit: -1 })
          .collect()
          .map(e => e.payload.value)
      );
      console.log("repreplicatedlkicated");
    });

    return new Promise((resolve, reject) => {
      db.events.on("write", (address, entry, heads) => {
        setLog(log => [...log, entry.payload.value]);
      });

      db.events.on("replicated", () => {
        const result = db
          .iterator({ limit: -1 })
          .collect()
          .map(e => e.payload.value);
        setLog(result);

        const isInGame = result.find(
          x => x.type === "joined" && x.data.type === "peer" && x.data.name === name
        );

        const gameFull = result.filter(x => x.type === "joined").length === 2;

        if (!isInGame && !gameFull) {
          db.add({
            type: "joined",
            data: {
              type: "peer",
              name: name,
            },
          });
          resolve();
        } else {
          reject(new Error("Game full"));
        }
      });
    });
  };

  return [db, log, create, join];
}
