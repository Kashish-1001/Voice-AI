const express = require("express");
const cors = require("cors");
require("dotenv").config();

const Task = require("./models/Task");
const connectDB = require("./db");

const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

// Home route
app.get("/", (req, res) => {
    res.send("Voice AI Assistant Backend is Running!");
});

// Gemini chat API

app.post("/api/ask", async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({
                error: "Please provide some text"
            });
        }

        let response;

        // Retry up to 3 times if Gemini is temporarily unavailable
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                response = await ai.models.generateContent({
                    model: "gemini-3.6-flash",
                    contents: `You are a helpful voice assistant.
                    Respond briefly and naturally to this user: ${text}`
                });

                break;

            } catch (error) {
                console.error(`Gemini attempt ${attempt} failed:`, error.message);

                if (attempt === 3) {
                    throw error;
                }

                await new Promise(resolve =>
                    setTimeout(resolve, attempt * 2000)
                );
            }
        }

        res.json({
            success: true,
            reply: response.text
        });

    } catch (error) {
        console.error("Gemini error:", error.message);

        res.status(503).json({
            error: "Gemini is temporarily busy. Please try again."
        });
    }
});


// Create task using Gemini and save in MongoDB
app.post("/api/tasks", async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({
                error: "Please provide a task description"
            });
        }

        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: `Extract task information from this request.

Return ONLY valid JSON:
{
    "title": "short task title",
    "description": "task details",
    "dueDate": null,
    "priority": "low, medium, or high"
}

If no date is mentioned, use null.
If no priority is mentioned, use medium.

User request: ${text}`
        });

        const cleaned = response.text
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        const taskData = JSON.parse(cleaned);

        const task = await Task.create({
            title: taskData.title,
            description: taskData.description || "",
            dueDate: taskData.dueDate || null,
            priority: taskData.priority || "medium"
        });

        res.status(201).json({
            success: true,
            message: "Task created successfully!",
            task
        });

    } catch (error) {
        console.error("Task creation error:", error.message);

        res.status(500).json({
            error: "Failed to create task"
        });
    }
});

// Get all saved tasks
app.get("/api/tasks", async (req, res) => {
    try {
        const tasks = await Task.find().sort({ createdAt: -1 });

        res.json({
            success: true,
            count: tasks.length,
            tasks
        });

    } catch (error) {
        console.error("Fetch tasks error:", error.message);

        res.status(500).json({
            error: "Failed to fetch tasks"
        });
    }
});


// Update task completion status
app.patch("/api/tasks/:id", async (req, res) => {
    try {
        const task = await Task.findByIdAndUpdate(
            req.params.id,
            { completed: req.body.completed },
            { new: true, runValidators: true }
        );

        if (!task) {
            return res.status(404).json({
                error: "Task not found"
            });
        }

        res.json({
            success: true,
            message: "Task updated successfully",
            task
        });

    } catch (error) {
        res.status(500).json({
            error: "Failed to update task"
        });
    }
});

// Delete task
app.delete("/api/tasks/:id", async (req, res) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.id);

        if (!task) {
            return res.status(404).json({
                error: "Task not found"
            });
        }

        res.json({
            success: true,
            message: "Task deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            error: "Failed to delete task"
        });
    }
});


// Start server and connect MongoDB
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (error) {
        console.error("Failed to start server:", error.message);
    }
};

startServer();
