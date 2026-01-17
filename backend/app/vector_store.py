"""
Vector Store for RAG: Store and retrieve optimization logs
"""
import chromadb
from chromadb.config import Settings
import json
from typing import List, Dict
import os


class OptimizationVectorStore:
    def __init__(self, persist_directory: str = "./chroma_db"):
        """Initialize ChromaDB client and collection."""
        self.client = chromadb.Client(Settings(
            persist_directory=persist_directory,
            anonymized_telemetry=False
        ))
        
        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name="optimization_logs",
            metadata={"description": "CPLEX optimization results and logs"}
        )
    
    def store_optimization(
        self,
        optimization_id: str,
        result: Dict,
        context: Dict
    ):
        """Store optimization result in vector DB."""
        
        # Create document text combining key info
        doc_text = f"""
        Optimization Status: {result.get('status')}
        Total Cost: ${result.get('total_cost', 0):.2f}
        Fill Schedule: {len(result.get('fill_schedule', []))} fillups
        Context: {json.dumps(context)}
        Solver Log: {result.get('solver_log', '')}
        """
        
        # Store in ChromaDB
        self.collection.add(
            documents=[doc_text],
            metadatas=[{
                "optimization_id": optimization_id,
                "status": result.get('status'),
                "total_cost": result.get('total_cost', 0),
                "timestamp": context.get('timestamp', ''),
                "num_trips": context.get('num_trips', 0)
            }],
            ids=[optimization_id]
        )
    
    def retrieve_similar(self, query: str, n_results: int = 3) -> List[Dict]:
        """Retrieve similar optimization logs for RAG context."""
        
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results
        )
        
        return [
            {
                "document": doc,
                "metadata": meta
            }
            for doc, meta in zip(
                results['documents'][0],
                results['metadatas'][0]
            )
        ]
