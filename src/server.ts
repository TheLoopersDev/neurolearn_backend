import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import app from './app';
import { connectDB } from './utils/db';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import ChatModel from './models/Chat.model';
import { Types } from 'mongoose';

dotenv.config();

// cloudinary config
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET
});

export let io: SocketIOServer;

// Connecting to MongoDB and Starting Server
export const startServer = async () => {
    try {
        await connectDB(process.env.DB_URI);

        console.log('MongoDB database connection established successfully');

        const server = http.createServer(app);
        io = new SocketIOServer(server, {
            cors: {
                origin: process.env.ORIGIN?.split(',') || ["http://localhost:3000", "http://localhost:8000"],
                credentials: true
            }
        });

        server.listen(process.env.PORT, () => {
            console.log(`Server is listening on port: http://localhost:${process.env.PORT} ....`);
        });

        io.on('connection', (socket) => {
            console.log('A user connected:', socket.id);

            socket.on('joinRoom', (roomId) => {
                socket.join(roomId);
                console.log(`User ${socket.id} joined room ${roomId}`);
            });

            socket.on('sendMessage', async ({ roomId, sender, content }) => {
                // Lưu message vào DB
                const chat = await ChatModel.findById(roomId);
                if (chat) {
                    const message = {
                        sender: new Types.ObjectId(sender),
                        content,
                        timestamp: new Date()
                    };
                    chat.messages.push(message);
                    await chat.save();
                    // Populate sender info nếu FE cần
                    const populatedMessage = {
                        ...message,
                        sender: await chat.populate({ path: 'messages.sender', select: '_id name avatar email' })
                    };
                    // Broadcast cho các user khác trong phòng (trừ người gửi)
                    io.to(roomId).emit('newMessage', populatedMessage);
                }
            });

            socket.on('disconnect', () => {
                console.log('User disconnected:', socket.id);
            });
        });
    } catch (error: any) {
        console.log('MongoDB connection error. Please make sure MongoDB is running: ');
    }
};

// Establish http server connection
startServer();

export default app;
