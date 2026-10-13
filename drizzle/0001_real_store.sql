CREATE TABLE IF NOT EXISTS `appSnapshots` (
  `ownerOpenId` varchar(64) NOT NULL,
  `snapshot` text NOT NULL,
  `version` int NOT NULL DEFAULT 1,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ownerOpenId`)
);
