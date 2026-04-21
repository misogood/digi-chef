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

//  Documenten inladen 
async function laadDocumenten() {
    console.log("Recepten inladen...");
    try {
        const loader = new DirectoryLoader("documenten", { ".pdf": (pad) => new PDFLoader(pad) });
        const ruweDocs = await loader.load();
        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
        const gesplitsteDocs = await splitter.splitDocuments(ruweDocs);

        const embeddings = new OpenAIEmbeddings({
            azureOpenAIApiKey: "07987396f9e64e9e8bd717e14068702b",
            azureOpenAIApiInstanceName: "cmgt-ai",
            azureOpenAIApiDeploymentName: "text-embedding-3-small",
            azureOpenAIApiVersion: "2025-03-01-preview",
        });
        
        vectorStore = await MemoryVectorStore.fromDocuments(gesplitsteDocs, embeddings);
        console.log("✅ Recepten succesvol ingeladen!");
    } catch (e) {
        console.log("⚠️ PDF fout, maar we gaan door.");
    }
}
laadDocumenten();


const azureClient = new OpenAI({
    apiKey: "07987396f9e64e9e8bd717e14068702b",
    baseURL: "https://cmgt-ai.openai.azure.com/openai/deployments/gpt-4.1-mini",
    defaultQuery: { 'api-version': "2025-03-01-preview" },
    defaultHeaders: { 'api-key': "07987396f9e64e9e8bd717e14068702b" }
});

app.post('/api/chat', async (req, res) => {
    try {
        const bericht = req.body.message;

        
        let context = "";
        if (vectorStore) {
            const resultaten = await vectorStore.similaritySearch(bericht, 2);
            context = resultaten.map(d => d.pageContent).join("\n");
        }

        // We roepen de AI aan zonder de buggy LangChain Chat GVDDD
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
        console.error("❌ Fout:", error);
        res.status(500).json({ error: "Server fout" });
    }
});

app.listen(3000, () => console.log('--- Chef draait op poort 3000 ---'));