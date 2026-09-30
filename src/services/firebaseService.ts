import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  orderBy, 
  limit,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface UserScore {
  username: string;
  totalScore: number;
  gamesPlayed: number;
  lastPlayed: any;
}

export const firebaseService = {
  async updateScore(userId: string, username: string, scoreToAdd: number) {
    if (!userId) return;
    
    const path = `leaderboard/${userId}`;
    try {
      const userRef = doc(db, 'leaderboard', userId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        await updateDoc(userRef, {
          totalScore: increment(scoreToAdd),
          gamesPlayed: increment(1),
          lastPlayed: serverTimestamp()
        });
      } else {
        await setDoc(userRef, {
          username,
          totalScore: scoreToAdd,
          gamesPlayed: 1,
          lastPlayed: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async getTopPlayers(limitCount: number = 10) {
    const path = 'leaderboard';
    try {
      const leaderboardRef = collection(db, 'leaderboard');
      const q = query(leaderboardRef, orderBy('totalScore', 'desc'), limit(limitCount));
      const querySnapshot = await getDocs(q);
      
      const players: any[] = [];
      querySnapshot.forEach((doc) => {
        players.push({ id: doc.id, ...doc.data() });
      });
      
      return players;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }
};
