from langchain_core.documents import Document


class KnowledgeBaseRetriever:
    def __init__(
        self,
        embedding_model,
        search_client,
        reranker,
        collection_name: str = "demo_collection",
    ):
        self._embedding_model = embedding_model
        self._search_client = search_client
        self._search_client.load_collection(
            collection_name="demo_collection"
        )
        self._reranker = reranker
        self._collection_name = collection_name

    def retrieve(self, query: str, top_k: int) -> list:
        if top_k < 5:
            raise ValueError("top_k must be >= 5 for reranking")

        vector = self._embedding_model.embed_query(query)

        return self._search_client.search(
            collection_name=self._collection_name,
            data=[vector],
            limit=top_k,
            output_fields=["text", "source"],
        )

    def rerank(self, query: str, search_results: list, top_k: int = 5):
        matches = search_results[0]
        query_and_chunk_pairs = []
        for result in matches:
            chunk_text = result["entity"]["text"]
            pair = (query, chunk_text)
            query_and_chunk_pairs.append(pair)

        scores = self._reranker.compute_score(query_and_chunk_pairs)

        documents = []
        for i in range(len(matches)):
            result = matches[i]
            score = scores[i]
            result["reranker_score"] = score
            docs = self.convert_to_document(result)
            documents.append(docs)

        return sorted(
            documents,
            key=lambda doc: doc.metadata["reranker_score"],
            reverse=True,
        )[:top_k]

    def retrieve_and_rerank(self,query: str, candidate_limit: int = 10,
                            result_limit: int = 5):
        results = self.retrieve(query, candidate_limit)
        return self.rerank(query, results, result_limit)

 ## Helper functions
    @staticmethod
    def get_page_numbers(dl_meta: dict):
        doc_items = dl_meta.get("doc_items", [])
        pages = set()

        for item in doc_items:
            provenance_list = item.get("prov", [])

            for provenance in provenance_list:
                if "page_no" in provenance:
                    page_number = provenance["page_no"]
                    pages.add(page_number)

        return sorted(pages)

    @staticmethod
    def convert_to_document(result: dict) -> Document:
        entity = result["entity"]
        source = entity["source"]
        dl_meta = source["dl_meta"]

        headings = dl_meta.get("headings", [])
        filename = dl_meta.get("origin", {}).get("filename")
        page_number = KnowledgeBaseRetriever.get_page_numbers(dl_meta)
        return Document(
            page_content=entity["text"],
            metadata={
                "entity_id": entity["id"],
                "filename": filename,
                "headings": headings,
                "page_numbers": page_number,
                "reranker_score": result.get("reranker_score"),
            },
        )
