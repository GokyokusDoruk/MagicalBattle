-- CreateTable
CREATE TABLE "save_games" (
    "userId" UUID NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "save_games_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "save_games" ADD CONSTRAINT "save_games_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
