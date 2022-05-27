const express = require('express')
const cors = require('cors')
var jwt = require('jsonwebtoken')       // requiring jwt
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000
// const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


app.use(cors());
app.use(express.json());      // to read data from body


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ekvdp.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    console.log(authHeader);
    if (!authHeader) {
        return res.status(401).send({ message: 'unauthorized access' });
    }

    const token = authHeader.split(' ')[1];
    console.log(token);
    console.log(process.env.ACCESS_TOKEN_SECRET);
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        req.decoded = decoded;
        console.log(req.decoded);
        next();
    })
}



async function run() {
    try {
        await client.connect();
        const userCollection = client.db('auto-parts-mart').collection('users');
        console.log('collection found');


        // updating or inserting the users in the db
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            console.log(email);
            const filter = { email: email };
            const options = { upsert: true };

            const user = req.body;
            console.log(user);
            const updatedDoc = {
                $set: {
                    name: user.name,
                    email: user.email,
                }
            };

            const result = await userCollection.updateOne(filter, updatedDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });     // generating jwt token
            res.send({ result, token });
        })

        // // getting specific user info from db
        // app.get('/user/:email', async (req, res) => {
        //     const email = req.params.email;
        //     const query = { email: email };
        //     const user = await userCollection.findOne(query);
        //     res.send(user);
        // })

        // getting all the users from db
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })


    } finally {

    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('This is Auto Parts Mart Server!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})