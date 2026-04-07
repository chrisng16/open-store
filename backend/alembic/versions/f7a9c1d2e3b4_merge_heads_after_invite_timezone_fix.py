"""merge heads after invite timezone fix

Revision ID: f7a9c1d2e3b4
Revises: e4f6a8b9c2d1, f1b2c3d4e5f6
Create Date: 2026-04-07 22:18:00.000000

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "f7a9c1d2e3b4"
down_revision: Union[str, Sequence[str], None] = ("e4f6a8b9c2d1", "f1b2c3d4e5f6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass



def downgrade() -> None:
    pass
