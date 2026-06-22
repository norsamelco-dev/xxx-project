CREATE DATABASE  IF NOT EXISTS `posdb_adv` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */;
USE `posdb_adv`;
-- MySQL dump 10.13  Distrib 8.0.34, for Win64 (x86_64)
--
-- Host: localhost    Database: posdb_adv
-- ------------------------------------------------------
-- Server version	5.5.5-10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `product_batches`
--

DROP TABLE IF EXISTS `product_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_batches` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` varchar(50) DEFAULT NULL,
  `batch_date` date DEFAULT NULL,
  `product_barcode` varchar(50) DEFAULT NULL,
  `Qty` int(11) DEFAULT NULL,
  `cost_price` decimal(10,2) DEFAULT NULL,
  `selling_price` decimal(10,2) DEFAULT NULL,
  `quantity_remaining` int(11) DEFAULT 0,
  `reoder_point` int(11) DEFAULT 0,
  `ExpiryDate` date DEFAULT NULL,
  `UserID` varchar(45) DEFAULT NULL COMMENT 'The user who added the stock',
  `Block` tinyint(4) DEFAULT 0,
  `branch_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_branch_id` (`branch_id`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_batches`
--

LOCK TABLES `product_batches` WRITE;
/*!40000 ALTER TABLE `product_batches` DISABLE KEYS */;
INSERT INTO `product_batches` VALUES (12,'B-001','2025-07-23','4123',0,30.00,42.36,0,0,'0000-00-00','1',0,1),(13,'B-001','2025-07-23','4801981118502',71,19.00,25.00,4,0,'0000-00-00','1',0,1),(18,'B-002','2026-05-23','4801981118502',102,30.00,50.00,102,0,'2030-05-23','1',0,1),(21,'B-001','2026-05-23','4800016661006',57,5.00,9.00,75,20,NULL,'1',0,1),(22,'B-001','2026-05-23','4800016082979',52,5.00,9.00,64,20,NULL,'1',0,1),(23,'B-001','2026-05-23','4801668200056',42,40.00,80.00,46,20,NULL,'1',0,1),(24,'B-002','2026-05-24','4800016082979',10,4.00,7.00,10,20,NULL,'1',0,1),(25,'B-003','2026-05-24','4800016082979',20,6.00,11.00,20,20,NULL,'1',0,1),(26,'B-004','2026-05-24','4800016082979',20,5.00,10.00,20,20,NULL,'1',0,1),(27,'B-001','2026-05-24','4800274020010',32,65.00,105.00,32,20,'2027-08-14','1',0,1);
/*!40000 ALTER TABLE `product_batches` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-22  5:22:18
