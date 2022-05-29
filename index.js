const express = require('express')
const cors = require('cors')
require('dotenv').config()
var jwt = require('jsonwebtoken')       // requiring jwt
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5050
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


app.use(cors());
app.use(express.json());      // to read data from body


// const uri = `mongodb+srv://auto-parts-mart-admin:s14oPxv47xpSikfM@cluster0.ekvdp.mongodb.net/?retryWrites=true&w=majority`;
// const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ekvdp.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

console.log(uri);

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
        const productCollection = client.db('auto-parts-mart').collection('products');
        const orderCollection = client.db('auto-parts-mart').collection('orders');
        const paymentCollection = client.db('auto-parts-mart').collection('payments');
        const reviewCollection = client.db('auto-parts-mart').collection('reviews');

        console.log('collection found');


        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;        // logged in users email
            const requesterAccount = await userCollection.findOne({ email: requester });

            if (requesterAccount.role === 'admin') {
                next();
            } else {
                res.status(403).send({ message: 'forbidden access' });
            }
        }


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
        app.get('/user/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            res.send(user);
        })


        // get api to check whether a user is admin or not. find operation.
        app.get('/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })

        // patch to update the profile of a user
        app.patch('/user/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const updateDoc = {
                $set: {
                    name: user.name,
                    email: user.email,
                    education: user.education,
                    location: user.location,
                    phone: user.phone,
                    linkedIn: user.linkedIn
                }
            }

            const updatedUser = await userCollection.updateOne(filter, updateDoc);
            res.send(updatedUser);
        })

        // getting all the users from db
        app.get('/user', verifyJWT, verifyAdmin, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })

        // api to make other users admin if you are an admin user
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            // if you are a admin, you can make others admin
            const email = req.params.email;     // email that the admin is trying to give admin permission. it has been fetched from the url
            const filter = { email: email };
            const updatedDoc = {
                $set: { role: 'admin' },
            };

            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // insert a product in the database, if you are an admin
        app.post('/product', verifyJWT, verifyAdmin, async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        })

        // get all the products list for manage products page
        app.get('/product', verifyJWT, verifyAdmin, async (req, res) => {
            const products = await productCollection.find().toArray();
            console.log(products);
            res.send(products);
        })

        // api to delete a product from manage product page
        app.delete('/product/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: ObjectId(id) };
            const result = await productCollection.deleteOne(filter);
            res.send(result);
        })

        // get all the products list for manage products page
        app.get('/product', verifyJWT, verifyAdmin, async (req, res) => {
            const products = await productCollection.find().toArray();
            console.log(products);
            res.send(products);
        })

        // get all the products list for manage products page
        app.get('/producthome', async (req, res) => {
            const products = await productCollection.find().toArray();
            console.log(products);
            res.send(products);
        })

        app.get('/product/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const product = await productCollection.findOne({ _id: ObjectId(id) });
            console.log('the product is', product);
            res.send(product);
        })

        // api to post a order
        app.post('/order', verifyJWT, async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send({ success: true, result });
        })

        // getting orders of a particular user
        app.get('/order', verifyJWT, async (req, res) => {
            const email = req.query.email;  // take data from the query url

            const decodedEmail = req.decoded.email;
            console.log(decodedEmail);
            if (email === decodedEmail) {
                const query = { userEmail: email };
                const cursor = orderCollection.find(query);
                const orders = await cursor.toArray();
                return res.send(orders);
            } else {
                return res.status(403).send({ message: 'forbidden access' });
            }
        })

        // api to delete a order from my orders page
        app.delete('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(filter);
            res.send(result);
        })

        // to display product order detail in payment page
        app.get('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await orderCollection.findOne(query);
            res.send(order);
        })

        // setting the payment intent api
        app.post("/create-payment-intent", verifyJWT, async (req, res) => {
            const order = req.body;
            const price = order.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });


        // to update payment data
        app.patch('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                }
            }

            const updatedOrder = await orderCollection.updateOne(filter, updateDoc);
            const result = await paymentCollection.insertOne(payment);
            res.send(updateDoc);
        })

        // get all orders for manage orders page
        app.get('/allorder', verifyJWT, verifyAdmin, async (req, res) => {
            const cursor = orderCollection.find();
            const orders = await cursor.toArray();
            res.send(orders);
        })


        // to update payment data
        app.patch('/shipOrder/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const updateDoc = {
                $set: {
                    shipped: true
                }
            }

            const updatedOrder = await orderCollection.updateOne(filter, updateDoc);
            res.send(updatedOrder);
        })

        // insert a review
        app.post('/review', verifyJWT, async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        })

        // getting all the reviews from db
        app.get('/review', async (req, res) => {
            const reviews = await reviewCollection.find().toArray();
            res.send(reviews);
        })

    } finally {

    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('This is Auto Parts Mart new modified Server !')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})