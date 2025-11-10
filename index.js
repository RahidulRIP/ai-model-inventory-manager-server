const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 7000;

// middleWare
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.v3edin0.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("building management site is sitting live");
});
async function run() {
  try {
    const aiModelsCollection = client.db("aiCraft").collection("aiModels");

    // my own code start from here

    // aiModel data adding from (AddModel.jsx) 
    app.post("/addModel", async (req, res) => {
      const { addModelInfo } = req.body;
      const result = await aiModelsCollection.insertOne(addModelInfo );
      res.send(result);
    });

    app.get("/models", async (req, res) => {
      const result = await aiModelsCollection.find().toArray();
      res.send(result);
    });

    // my own code end here

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`this is running from ${port}`);
});
