const express = require("express");

const app = express();

app.get("/", (req, res) => {
    res.send("Backend Running Successfully 🚀");
});

app.get("/api/products", (req, res) => {
    res.json([
        {
            id: 1,
            name: "Mango Juice",
            price: 60
        },
        {
            id: 2,
            name: "Orange Juice",
            price: 50
        }
    ]);
});

app.listen(5000, () => {
    console.log("Server running on port 5000");
});