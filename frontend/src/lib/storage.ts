import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory and file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [], posts: [] }), 'utf-8');
}

export type User = {
  id: string;
  email: string;
  name: string;
  bio?: string;
};

export type Post = {
  id: string;
  title: string;
  content: string;
  ticker: string;
  sentiment: string;
  aiConfidenceScore?: number;
  aiRiskAnalysis?: string;
  authorId: string;
  createdAt: string;
  _count?: {
    comments: number;
    likes: number;
  };
  author?: {
    name: string;
    image?: string;
    bio?: string;
  };
};

export type Database = {
  users: User[];
  posts: Post[];
};

function readDB(): Database {
  const data = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(data);
}

function writeDB(data: Database) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// User Operations
export const storage = {
  user: {
    findUnique: async ({ where }: { where: { email?: string; id?: string } }) => {
      const db = readDB();
      return db.users.find(u => 
        (where.email && u.email === where.email) || 
        (where.id && u.id === where.id)
      ) || null;
    },
    create: async ({ data }: { data: Omit<User, 'id'> }) => {
      const db = readDB();
      const newUser: User = { ...data, id: Date.now().toString() };
      db.users.push(newUser);
      writeDB(db);
      return newUser;
    }
  },
  post: {
    create: async ({ data }: { data: Omit<Post, 'id' | 'createdAt'> }) => {
      const db = readDB();
      const newPost: Post = { 
        ...data, 
        id: Date.now().toString(), 
        createdAt: new Date().toISOString() 
      };
      db.posts.unshift(newPost); // Add at the beginning
      writeDB(db);
      return newPost;
    },
    findMany: async (options?: any) => {
      const db = readDB();
      // Attach author data manually for the response
      const postsWithAuthors = db.posts.map(post => {
        const author = db.users.find(u => u.id === post.authorId);
        return {
          ...post,
          _count: post._count || { comments: 0, likes: 0 },
          author: author ? {
            name: author.name,
            bio: author.bio
          } : { name: "Unknown User" }
        };
      });
      // Sort by createdAt descending
      return postsWithAuthors.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }
};
