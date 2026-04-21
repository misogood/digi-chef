import express from 'express';
import dotenv from 'dotenv';
import { OpenAI } from "openai"; 
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.static('public'));

const chatGeschiedenis = []; 
let vectorStore;


async function laadDocumenten() {
    console.log("Recepten inladen...");
    try {
        const loader = new DirectoryLoader("documenten", { ".pdf": (pad) => new PDFLoader(pad) });
        const ruweDocs = await loader.load();
        
        
        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
        const gesplitsteDocs = await splitter.splitDocuments(ruweDocs);

       
        const embeddings = new OpenAIEmbeddings({
            azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
            azureOpenAIApiInstanceName: "cmgt-ai",
            azureOpenAIApiDeploymentName: "text-embedding-3-small",
            azureOpenAIApiVersion: "2025-03-01-preview"
        });

        
        vectorStore = await MemoryVectorStore.fromDocuments(gesplitsteDocs, embeddings);
        console.log("✅ Recepten succesvol ingeladen!");
    } catch (error) {
        console.error("❌ Fout bij inladen documenten:", error);
    }
}

laadDocumenten();


const azureClient = new OpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    baseURL: `https://cmgt-ai.openai.azure.com/openai/deployments/gpt-4.1-mini`,
    defaultQuery: { 'api-version': "2025-03-01-preview" },
    defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY }
});

app.post('/api/chat', async (req, res) => {
    try {
        const bericht = req.body.message;

        let context = "";
        if (vectorStore) {
            const resultaten = await vectorStore.similaritySearch(bericht, 2);
            context = resultaten.map(d => d.pageContent).join("\n");
        }

        const response = await azureClient.chat.completions.create({
            model: "gpt-4.1-mini",
            messages: [
                { role: "system", content: "Jij bent een vrolijke chef-kok. Gebruik deze context: " + context },
                ...chatGeschiedenis,
                { role: "user", content: bericht }
            ]
        });

        const antwoord = response.choices[0].message.content;

       
        console.log(`\x1b[36m[Tokens]\x1b[0m Totaal verbruikt: ${response.usage.total_tokens}`);

      
        chatGeschiedenis.push({ role: "user", content: bericht });
        chatGeschiedenis.push({ role: "assistant", content: antwoord });

        res.json({ reply: antwoord });
    } catch (error) {
        console.error("❌ Server Fout:", error);
        res.status(500).json({ error: "Er ging iets mis bij de Chef." });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`--- Chef draait op poort ${PORT} ---`);
});