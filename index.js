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
    const userCollection = client.db("aiCraft").collection("users");

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
    app.delete("/deleteModel/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await aiModelsCollection.deleteOne(query);
      res.send(result);
    });

    // this patch related to (UpdatePage.jsx)
    app.patch("/updateModelData/:id", verifyToken, async (req, res) => {
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

    // new start
    // Get User Statistics for Dashboard
    app.get("/user-stats", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (req.token_email !== email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      // 1. Total models created by this user
      const modelsCreated = await aiModelsCollection.countDocuments({
        createdBy: email,
      });

      // 2. Total models purchased by this user
      const modelsPurchased = await purchasedAiModelsCollection.countDocuments({
        purchased_By: email,
      });

      // 3. Get recent activities (Last 5 purchases)
      const recentPurchases = await purchasedAiModelsCollection
        .find({ purchased_By: email })
        .sort({ timestamp: -1 })
        .limit(5)
        .toArray();

      // 4. Data for the Chart (Example: Framework distribution in their collection)
      const frameworks = await purchasedAiModelsCollection
        .aggregate([
          { $match: { purchased_By: email } },
          { $group: { _id: "$framework", count: { $sum: 1 } } },
        ])
        .toArray();

      res.send({
        modelsCreated,
        modelsPurchased,
        recentPurchases,
        chartData: frameworks.map((item) => ({
          name: item._id || "Unknown",
          value: item.count,
        })),
      });
    });

    // dashboard admin data
    app.get("/admin-stats", async (req, res) => {
      try {
        const totalUsers = await userCollection.estimatedDocumentCount();

        const totalModels = await aiModelsCollection.estimatedDocumentCount();

        const stats = await purchasedAiModelsCollection
          .aggregate([
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: "$price" },
                totalSales: { $sum: 1 },
              },
            },
          ])
          .toArray();

        const revenue = stats.length > 0 ? stats[0].totalRevenue : 0;
        const salesCount = stats.length > 0 ? stats[0].totalSales : 0;

        res.send({
          totalUsers,
          totalModels,
          totalRevenue: revenue,
          totalSales: salesCount,
        });
      } catch (error) {
        res.status(500).send({ message: "Error fetching admin stats" });
      }
    });

    // users collection data adding from (SignUp.jsx)
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };

      // Check if user already exists (important for Google Sign-In)
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }

      // Define the new user object with server-side defaults
      const newUser = {
        name: user.name,
        email: user.email,
        photo: user.photo,
        role: "user", // ROLE ADDED FROM SERVER
        createdAt: new Date(), // DATE ADDED FROM SERVER
      };

      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    // Fetch a single user's data (including role) by email
    app.get("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      // Security check: Only let the logged-in user see their own data
      if (req.token_email !== email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const query = { email: email };
      const result = await userCollection.findOne(query);

      if (!result) {
        return res.status(404).send({ message: "User not found" });
      }

      res.send(result);
    });

    // Add a PATCH route to update profile name/photo in MongoDB
    app.patch("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const updatedData = req.body;
      const filter = { email: email };
      const updateDoc = {
        $set: {
          name: updatedData.name,
          photo: updatedData.photo,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // --- ADMIN ONLY: GET ALL MODELS ---
    app.get("/admin/all-models", verifyToken, async (req, res) => {
      // Basic role check (Optional: could also check DB role here)
      const result = await aiModelsCollection.find().toArray();
      res.send(result);
    });

    // --- ADMIN ONLY: GET ALL PURCHASE HISTORY ---
    app.get("/admin/all-purchases", verifyToken, async (req, res) => {
      const result = await purchasedAiModelsCollection.find().toArray();
      res.send(result);
    });

    // --- ADMIN ONLY: DELETE ANY MODEL ---
    app.delete("/admin/delete-model/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await aiModelsCollection.deleteOne(query);
      res.send(result);
    });

    // delete purchase log from db by admin
    app.delete("/admin/delete-purchase/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        // Attempting to delete the purchase log from the database
        const result = await purchasedAiModelsCollection.deleteOne(query);

        if (result.deletedCount === 1) {
          res.status(200).send({
            deletedCount: 1,
            message: "Purchase record successfully purged.",
          });
        } else {
          res.status(404).send({ message: "Record not found in database." });
        }
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    // new end

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`this server site is running from ${port}`);
});
