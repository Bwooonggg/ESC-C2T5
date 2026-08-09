from pydantic import BaseModel, Field


class WorksheetItem(BaseModel):
    question: str = Field(min_length=1)
    options: list[str] = Field(default_factory=list)
    answer: str = Field(min_length=1)


class GeneratedWorksheet(BaseModel):
    title: str = Field(min_length=1)
    readingPassage: str = Field(min_length=1)
    instructions: str = Field(min_length=1)
    items: list[WorksheetItem] = Field(min_length=1)


class MCQWorksheetItem(WorksheetItem):
    question: str = Field(
        min_length=1,
        description=(
            "A complete question ending in a question mark, or a meaningful "
            "sentence-completion prompt containing a blank such as ____. "
            "Never put only the answer in this field."
        ),
    )
    options: list[str] = Field(
        min_length=4,
        max_length=4,
        description="Exactly four distinct answer choices for the question",
    )
    answer: str = Field(
        min_length=1,
        description="The correct choice, exactly matching one value in options",
    )


class GeneratedMCQWorksheet(GeneratedWorksheet):
    items: list[MCQWorksheetItem] = Field(min_length=1)


class OpenEndedWorksheetItem(WorksheetItem):
    options: list[str] = Field(default_factory=list, max_length=0)


class GeneratedOpenEndedWorksheet(GeneratedWorksheet):
    items: list[OpenEndedWorksheetItem] = Field(min_length=1)
