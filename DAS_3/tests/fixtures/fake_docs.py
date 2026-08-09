from langchain_core.documents import Document

fake_docs = [
    Document(
        page_content=(
            "Dyslexia is a learning difference that primarily affects reading fluency, "
            "decoding, and spelling. Common signs include difficulty matching letters "
            "to sounds, slow reading speed, and trouble with word recognition."
        ),
        metadata={"source": "dyslexia_overview.pdf"},
    ),
    Document(
        page_content=(
            "Multisensory teaching approaches, such as Orton-Gillingham, combine visual, "
            "auditory, and kinesthetic-tactile pathways to help learners with dyslexia "
            "build stronger connections between letters and sounds."
        ),
        metadata={"source": "teaching_strategies.pdf"},
    ),
    Document(
        page_content=(
            "Phonological awareness — the ability to recognize and manipulate sounds in "
            "spoken language — is one of the strongest predictors of reading success and "
            "is often an area of difficulty for learners with dyslexia."
        ),
        metadata={"source": "phonological_awareness.pdf"},
    ),
    Document(
        page_content=(
            "Grammar skills, including subject-verb agreement, verb tense consistency, "
            "and correct use of articles and pronouns, are often challenging for learners "
            "with dyslexia due to underlying difficulties with working memory and "
            "processing language structure."
        ),
        metadata={"source": "grammar_fundamentals.pdf"},
    ),
    Document(
        page_content=(
            "Common grammar errors seen in learners with dyslexia include omitting small "
            "function words (e.g., 'the', 'is', 'to'), confusing homophones like 'their', "
            "'there', and 'they're', and inconsistent use of past and present tense within "
            "the same sentence."
        ),
        metadata={"source": "grammar_error_patterns.pdf"},
    ),
]