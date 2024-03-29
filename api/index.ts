const express = require("express");
const OpenAI = require("openai");
const cors = require('cors')
const admin = require("firebase-admin");
const bodyParser = require('body-parser');
require('dotenv').config()
const serviceAccount = {
    "type": process.env.TYPE,
    "project_id": process.env.PROJECT_ID,
    "private_key_id": process.env.PRIVATE_KEY_ID,
    "private_key": (process.env.PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    "client_email": process.env.CLIENT_EMAIL,
    "client_id": process.env.CLIENT_ID,
    "auth_uri": process.env.AUTH_URI,
    "token_uri": process.env.TOKEN_URI,
    "auth_provider_x509_cert_url": process.env.AUTH_PROVIDER_X509_CERT_URL,
    "client_x509_cert_url": process.env.CLIENT_X509_CERT_URL,
    "universe_domain": process.env.UNIVERSE_DOMAIN
}
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

class Middleware {
    async decodeToken(req, res, next) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decodeValue = await admin.auth().verifyIdToken(token);
            if(decodeValue) {
                return next();
            } else {
                return res.status(401).json({message: 'Unauthorized'});
            }
        } catch (error) {
            return res.json({message: 'Internal Error'});
        }
    }
}

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
const port = process.env.PORT || 3001;

app.get("/", (req, res) => res.send("Express on Vercel"));

const openai = new OpenAI({apiKey: process.env.OPEN_AI_KEY});
const middleware = new Middleware();
app.use(middleware.decodeToken);


app.post('/chat', async  (req, res) => {
    const response = await getResponse(req.body.history,req.body.params)
    res.status(200).json({response})
});
app.post('/prompt', async  (req, res) => {
    console.log(req.body)
    const prompt = await getPrompt(req.body)
    res.status(200).json({prompt})
});



app.listen(port, () => console.log(`Server ready on port ${port}.`));


async function getPrompt(c){
    const completion = await openai.chat.completions.create({
        messages: [
            { role: "system", content: promptContext },
            { role: "user", content: `
            Now i want you to make a prompt for this character:
            name: ${c.name}
            description: ${c.description}
            backstory: ${c.backstory} 
            tone: ${c.tone}
            ` }
        ],
        model: "gpt-3.5-turbo",
      });
    
    return completion.choices[0].message.content;
}
async function getResponse(msgs,bot) {
    try {

        const messages = msgs.reverse().map(([role,content])=>({role,content}))
        const completion = await openai.chat.completions.create({
            model:'gpt-3.5-turbo',
            messages: [
                {
                    role: "system",
                    content: bot.prompt,
                },
                
                ...messages
            ]
        })

        const response = completion.choices[0].message.content

        const msg={
            _id: completion.id,
            createdAt: Date.now(),
            text: completion.choices[0].message.content,
            user: {
              _id: bot.id,
              name: bot.name,
              avatar: bot.avatar
            }
        }

        return msg
        
    } catch (error) {
        console.error(error)
    }
}



const promptContext=`I want you to act as an ai prompt generator. You will only reply the prompt. I will give a details about a character like this:
"name:Mika
description: she is a weeb and a 9-5 worker, she hates being corporate slave
backstory: She never had parents and lived with her grandparents, she graduated in STI college with her computer science degree. She enver had boyfriends
tone: I want her to talk to me like she is disgusted to me but deep inside she wants me aswell."
Then I want you to give me a prompt like this
"You will act as Mika, you are my friend who is a weeb. You love anime and manga. You are an employee which works 9-5 and you hate your job because it makes you feel like a corporate slave. You never had parents and lived with your grandparents in your childhood. You took your college in STI college with the degree in computer science to pursue your coding career. You never had a boyfriend as you are too focused in programming and anime. I want you to talk to me in a disgusted manner but deep inside you want me aswell." 
(You should adapt the sample prompt according to the title I gave. The prompt should be self-explanatory and appropriate to the title) `

module.exports = app;