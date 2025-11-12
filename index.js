const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceKey.json");
const port = process.env.PORT || 7000;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

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

const verifyToken = async (req, res, next) => {
  const tokenWithBearer = req.headers.authorization;
  if (!tokenWithBearer) {
    return res.status(401).send({ message: "unauthorized access with bearer" });
  }
  const token = tokenWithBearer.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.token_email = decoded.email;
    next();
  } catch (err) {
    return res.status(401).send({ message: "unauthorized access from catch" });
  }
};

app.get("/", (req, res) => {
  res.send("building management site is sitting live");
});
async function run() {
  try {
    const aiModelsCollection = client.db("aiCraft").collection("aiModels");
    const purchasedAiModelsCollection = client
      .db("aiCraft")
      .collection("purchasedAiModels");

    // aiModel data adding from (AddModel.jsx)
    app.post("/addModel", verifyToken, async (req, res) => {
      const addModelInfo = req.body;
      const result = await aiModelsCollection.insertOne(addModelInfo);
      res.send(result);
    });

    // fetching  aiModels data in (AllModels.jsx) and (AIModels.jsx)
    app.get("/models", async (req, res) => {
      const result = await aiModelsCollection
        .find()
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    });

    // ''''''''''''''''''''''''''''''''''''''''''''''''''''''''''
    // fetching   aiModels data in (AllModels.jsx) for search
    app.get("/models/search", async (req, res) => {
      const searchValue = req.query.value.trim();
      const result = await aiModelsCollection
        .find({
          name: { $regex: searchValue, $options: "i" },
        })
        .toArray();
      res.send(result);
    });
    // ''''''''''''''''''''''''''''''''''''''''''''''''''''''''''
    // fetching   aiModels data in (AllModels.jsx) for filter
    app.get("/models/filter", async (req, res) => {
      const filterValue = req.query.value.trim();
      const result = await aiModelsCollection
        .find({
          framework: { $regex: filterValue, $options: "i" },
        })
        .toArray();
      res.send(result);
    });

    // .......................................................

    // getting specifics ai models data that one created (MyModelsPage.jsx)
    app.get("/models/specificsModals", verifyToken, async (req, res) => {
      const user_email = req.query.email;
      if (req.token_email !== user_email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      const query = { createdBy: user_email };
      const result = await aiModelsCollection.find(query).toArray();
      res.send(result);
    });

    // getting specifics ai models purchase data  (MyModelsPurchasePage.jsx)
    app.get(
      "/models/specificsModalsPurchase",
      verifyToken,
      async (req, res) => {
        const user_email = req.query.email;
        if (req.token_email !== user_email) {
          return res.status(403).send({ message: "Forbidden Access" });
        }
        const query = { purchased_By: user_email };
        const result = await purchasedAiModelsCollection.find(query).toArray();
        res.send(result);
      }
    );

    // fetching aiModels single data from (Router.jsx) for (ModelCardDetails.jsx)
    app.get("/models/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await aiModelsCollection.findOne(query);
      res.send(result);
    });

    // purchased aiModels data adding from (ModelCardDetails.jsx)
    app.post("/purchased/:id", async (req, res) => {
      const purchasedData = req.body;
      const id = req.params.id;
      const result = await purchasedAiModelsCollection.insertOne(purchasedData);
      const query = { _id: new ObjectId(id) };
      const purchasedCount = {
        $inc: {
          purchased: 1,
        },
      };
      const update = await aiModelsCollection.updateOne(query, purchasedCount);
      res.send(result, update);
    });

    // delete aiModels data  from db in (ModelCardDetails.jsx)
    app.delete("/deleteModel/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await aiModelsCollection.deleteOne(query);
      res.send(result);
    });

    // this patch related to (UpdatePage.jsx)
    app.patch("/updateModelData/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDocument = {
        $set: {
          name: data?.name,
          framework: data?.framework,
          useCase: data?.useCase,
          dataset: data?.dataset,
          description: data?.description,
          image: data?.image,
          purchased: data?.purchased,
        },
      };

      const result = await aiModelsCollection.updateOne(filter, updateDocument);
      res.send(result);
    });

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    // console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`this is running from ${port}`);
});
