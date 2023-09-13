import { SCREEN_HEIGHT, SCREEN_WIDTH } from "./TextModeScreen";

export interface Session {
  id: number;
  headUpdateId: number;
  saved: boolean;
}

export interface Update {
  id: number;
  sessionId: number;
  parentUpdateId: number;
  data: Uint16Array;
  x: number;
  y: number;
  width: number;
  height: number;
}

const applyUpdate = (baseData: Uint16Array, { x, y, width, height, data }: { x: number, y: number, width: number, height: number, data: Uint16Array }) => {
  for (let yo = 0; yo < height; yo++) {
    for (let xo = 0; xo < width; xo++) {
      baseData[(y + yo) * SCREEN_WIDTH + x + xo] ^= data[yo * width + xo];
    }
  }
};

type Insertion<T> = Omit<T, 'id'>;

let db: Promise<IDBDatabase>;
function getDOSDrawDB(): Promise<IDBDatabase> {
  return db = db || new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('dosdraw', 1);
    req.onerror = () => {
      reject(req.error || 'unable to open db');
    };
    req.onblocked = () => {
      reject('blocked');
    };
    req.onupgradeneeded = ({ oldVersion, newVersion }) => {
      if (oldVersion < 1) {
        const db = req.result;
        const sessions = db.createObjectStore('sessions', {autoIncrement: true, keyPath:'id'});
        const updates = db.createObjectStore('updates', {autoIncrement:true, keyPath:'id'});
        updates.createIndex('bySessionId', 'sessionId', {unique: false, multiEntry: false});
        updates.createIndex('byParentUpdateId', 'parentUpdateId', {unique: false, multiEntry: false});
      }
    };
    req.onsuccess = () => {
      resolve(req.result);
    };
  });
}

export function openSession(initialData: Uint16Array): Promise<{sessionId: number, headUpdateId: number}> {
  return getDOSDrawDB().then(db => new Promise((resolve, reject) => {
    const tn = db.transaction(['sessions', 'updates'], 'readwrite');
    const sessions = tn.objectStore('sessions');
    const updates = tn.objectStore('updates');
    const result = {sessionId: -1, headUpdateId: -1};
    tn.oncomplete = () => {
      resolve(result);
    };
    tn.onerror = () => {
      reject(tn.error || 'db failure');
    };
    const req = sessions.add({
      saved: true,
      headUpdateId: -1,
    } satisfies Insertion<Session>);
    req.onsuccess = () => {
      const sessionId = req.result as number;
      result.sessionId = sessionId;
      const req2 = updates.add({
        sessionId,
        parentUpdateId: -1,
        data: initialData,
        x: 0, y: 0,
        width: SCREEN_WIDTH, height: SCREEN_HEIGHT,
      } satisfies Insertion<Update>);
      req2.onsuccess = () => {
        const initialUpdateId = req2.result as number;
        result.headUpdateId = initialUpdateId;
        sessions.put({id: sessionId, saved: true, headUpdateId:initialUpdateId} satisfies Session);
      };
    };
  }));
}

export function findUnsavedSessions(): Promise<number[]> {
  return getDOSDrawDB().then(db => new Promise((resolve, reject) => {
    const tn = db.transaction(['sessions', 'updates'], 'readonly');
    const sessions = tn.objectStore('sessions');
    tn.onerror = () => {
      reject(tn.error || 'db failure');
    };
    const keys: number[] = [];
    const req = sessions.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(keys);
      }
      else {
        const session: Session = cursor.value;
        if (!session.saved) {
          keys.push(session.id);
        }
        cursor.continue();
      }
    };
  }));
}

export function setSessionSaved(sessionId: number, headUpdateId: number): Promise<void> {
  return getDOSDrawDB().then(db => new Promise((resolve, reject) => {
    const tn = db.transaction(['sessions'], 'readwrite');
    tn.oncomplete = () => {
      resolve();
    };
    tn.onerror = () => {
      reject(tn.error || 'db failure');
    };
    const sessions = tn.objectStore('sessions');
    const req = sessions.get(sessionId);
    req.onsuccess = () => {
      const session = req.result as Session | undefined;
      if (session && !session.saved) {
        session.saved = true;
        session.headUpdateId = headUpdateId;
        sessions.put(session);
      }
    };
  }));
}

function getNonZeroRegion(xorData: Uint16Array) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let x = 0; x < SCREEN_WIDTH; x++)
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    if (xorData[y*SCREEN_WIDTH + x]) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (minX === Infinity) return { width: 0, height: 0, x: 0, y: 0, data: new Uint16Array(0) };
  const width = maxX + 1 - minX;
  const height = maxY + 1 - minY;
  const reduced = new Uint16Array(width * height);
  for (let y = 0; y < height; y++) {
    reduced.set(xorData.subarray((minY + y) * SCREEN_WIDTH + minX, (minY + y) * SCREEN_WIDTH + minX + width), y * width);
  }
  return {
    width, height, x: minX, y: minY, data: reduced,
  };
}

export function addSessionUpdate(sessionId: number, headUpdateId: number, fromData: Uint16Array, toData: Uint16Array): Promise<number> {
  const xorData = new Uint16Array(SCREEN_WIDTH * SCREEN_HEIGHT);
  for (let i = 0; i < xorData.length; i++) {
    xorData[i] = fromData[i] ^ toData[i];
  }
  const { x, y, width, height, data } = getNonZeroRegion(xorData);
  return getDOSDrawDB().then(db => new Promise((resolve, reject) => {
    const tn = db.transaction(['sessions', 'updates'], 'readwrite');
    const sessions = tn.objectStore('sessions');
    const updates = tn.objectStore('updates');
    const req = sessions.get(sessionId);
    let key = -1;
    tn.oncomplete = () => {
      resolve(key);
    };
    tn.onerror = () => {
      reject(tn.error || 'db failure');
    }
    req.onsuccess = () => {
      const session = req.result as Session | undefined;
      if (session) {
        const update: Insertion<Update> = { sessionId: session.id, x, y, width, height, data, parentUpdateId: headUpdateId };
        const req2 = updates.add(update);
        req2.onsuccess = () => {
          key = req2.result as number;
          session.saved = false;
          session.headUpdateId = key;
          sessions.put(session);
        };
      }
      else {
        reject('session not found: ' + sessionId);
      }
    };
  }));
}

export function undo(sessionId: number, headUpdateId: number, data: Uint16Array): Promise<{data:Uint16Array, newUpdateId: number}> {
  return getDOSDrawDB().then(db => new Promise((resolve, reject) => {
    const tn = db.transaction(['updates', 'sessions'], 'readwrite');
    const sessions = tn.objectStore('sessions');
    const updates = tn.objectStore('updates');
    const req = updates.get(headUpdateId);
    let newUpdateId = -1;
    tn.oncomplete = () => {
      resolve({data, newUpdateId});
    };
    tn.onerror = () => {
      reject(tn.error || 'db failure');
    }
    req.onsuccess = () => {
      const update = req.result as Update | undefined;
      if (!update) {
        throw new Error('update not found: ' + headUpdateId);
      }
      if (update.sessionId !== sessionId) {
        throw new Error('wrong session id');
      }
      if (update.parentUpdateId === -1) {
        newUpdateId = headUpdateId;
        return;
      }
      newUpdateId = update.parentUpdateId;
      const req2 = sessions.get(sessionId);
      applyUpdate(data, update);
      req2.onsuccess = () => {
        const session = req.result as Session | undefined;
        if (!session) {
          throw new Error('session not found: ' + sessionId);
        }
        session.saved = false;
        session.headUpdateId = update.parentUpdateId;
        sessions.put(session);
      };
    };
  }));
}

export function redo(sessionId: number, headUpdateId: number, data: Uint16Array): Promise<{data:Uint16Array, newUpdateId: number}> {
  return getDOSDrawDB().then(db => new Promise((resolve, reject) => {
    const tn = db.transaction(['updates', 'sessions'], 'readwrite');
    const sessions = tn.objectStore('sessions');
    const updates = tn.objectStore('updates');
    const updatesByParentUpdateId = updates.index('byParentUpdateId');
    let newUpdateId = -1;
    tn.oncomplete = () => {
      resolve({data, newUpdateId});
    };
    tn.onerror = () => {
      reject(tn.error || 'db failure');
    };
    const req = updatesByParentUpdateId.openCursor(headUpdateId, 'prev');
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        newUpdateId = headUpdateId;
        return;
      }
      const update = cursor.value as Update;
      if (update.sessionId !== sessionId) {
        throw new Error('wrong session id');
      }
      applyUpdate(data, update);
      newUpdateId = update.id;
      sessions.put({id:sessionId, headUpdateId: update.id, saved: false} satisfies Session);
    };
  }));
}

export function loadSession(sessionId: number): Promise<{data:Uint16Array, headUpdateId:number}> {
  const data = new Uint16Array(SCREEN_WIDTH * SCREEN_HEIGHT);
  let lastUpdateId = -1;
  return getDOSDrawDB().then(db => new Promise((resolve, reject) => {
    const tn = db.transaction(['sessions', 'updates'], 'readonly');
    tn.oncomplete = () => {
      resolve({data, headUpdateId:lastUpdateId!});
    };
    tn.onerror = () => {
      reject(tn.error || 'db failure');
    }
    const sessions = tn.objectStore('sessions');
    const updates = tn.objectStore('updates');
    const req = sessions.get(sessionId);
    req.onsuccess = () => {
      const session = req.result as Session | undefined;
      if (!session) {
        throw new Error('session not found: ' + sessionId);
      }
      lastUpdateId = session.headUpdateId;
      const req2 = updates.get(session.headUpdateId);
      let keys: number[] = [];
      function onsuccess(this: IDBRequest<Update | undefined>) {
        const update = this.result;
        if (!update) {
          throw new Error('update not found');
        }
        if (update.parentUpdateId === -1) {
          applyUpdate(data, update);
          function nextUpdate() {
            const key = keys.pop();
            if (key === undefined) return;
            function onsuccess2(this: IDBRequest<Update | undefined>) {
              const update = this.result;
              if (!update) {
                throw new Error('update not found');
              }
              applyUpdate(data, update);
              nextUpdate();
            }
            const req4 = updates.get(key);
            req4.onsuccess = onsuccess2;
          }
          nextUpdate();
        }
        else {
          keys.push(update.id);
          const req3 = updates.get(update.parentUpdateId);
          req3.onsuccess = onsuccess;
        }
      }
      req2.onsuccess = onsuccess;
    };
  }));  
}

export function clearSession(sessionId: number): Promise<void> {
  return getDOSDrawDB().then(db => new Promise((resolve, reject) => {
    const tn = db.transaction(['sessions', 'updates'], 'readonly');
    tn.oncomplete = () => {
      resolve();
    };
    tn.onerror = () => {
      reject(tn.error || 'db failure');
    }
    const sessions = tn.objectStore('sessions');
    const updates = tn.objectStore('updates');
    const updatesBySessionId = updates.index('bySessionId');
    sessions.delete(sessionId);
    const req = updatesBySessionId.openCursor(sessionId);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
  }));
}
