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
-- Table structure for table `product_batches_sync_history`
--

DROP TABLE IF EXISTS `product_batches_sync_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_batches_sync_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sync_batch_id` varchar(64) NOT NULL,
  `sync_code` varchar(20) DEFAULT NULL,
  `sync_timestamp` datetime NOT NULL DEFAULT current_timestamp(),
  `user_id` varchar(45) DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `product_barcode` varchar(100) DEFAULT NULL,
  `product_name` varchar(500) DEFAULT NULL,
  `batch_id` varchar(100) DEFAULT NULL,
  `qty_before` int(11) NOT NULL DEFAULT 0,
  `qty_added` int(11) NOT NULL DEFAULT 0,
  `qty_after` int(11) NOT NULL DEFAULT 0,
  `cost_price` decimal(10,2) DEFAULT NULL,
  `selling_price` decimal(10,2) DEFAULT NULL,
  `expiration_date` date DEFAULT NULL,
  `source` varchar(40) NOT NULL DEFAULT 'batch_sync',
  `branch_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sync_timestamp` (`sync_timestamp`),
  KEY `idx_sync_code` (`sync_code`),
  KEY `idx_product_barcode` (`product_barcode`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_sync_batch_id` (`sync_batch_id`),
  KEY `idx_branch_id` (`branch_id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_batches_sync_history`
--

LOCK TABLES `product_batches_sync_history` WRITE;
/*!40000 ALTER TABLE `product_batches_sync_history` DISABLE KEYS */;
INSERT INTO `product_batches_sync_history` VALUES (1,'e8163129-318b-4e81-9142-48d9716e4d51','20260523_001','2026-05-23 12:01:29','1','admin','4801981118502','290ml Coca-cola','B-002',87,102,189,30.00,50.00,'2030-05-23','batch_sync',1),(2,'e8163129-318b-4e81-9142-48d9716e4d51','20260523_001','2026-05-23 12:01:29','1','admin','85558','CEMENT','B-004',34,300,334,200.00,320.00,NULL,'batch_sync',1),(3,'e8163129-318b-4e81-9142-48d9716e4d51','20260523_001','2026-05-23 12:01:29','1','admin','8755885','10MM STEEL BAR','B-003',0,50,50,180.00,300.00,NULL,'batch_sync',1),(4,'4be5a8e4-e43a-4e5d-80db-3f48f0579b0e','20260523_002','2026-05-23 20:00:07','1','admin','4800016661006','Roller Coaster Potato Ringes 24G','B-001',0,100,100,5.00,9.00,NULL,'batch_sync',1),(5,'4be5a8e4-e43a-4e5d-80db-3f48f0579b0e','20260523_002','2026-05-23 20:00:07','1','admin','4800016082979','Magic Chips BBQ Flav 28g','B-001',0,100,100,5.00,9.00,NULL,'batch_sync',1),(6,'c12fed16-4259-431a-9ef7-6c6800c75c97','20260523_003','2026-05-23 20:06:20','1','admin','4801668200056','MAFRAN 320G','B-001',0,50,50,40.00,80.00,NULL,'batch_sync',1),(7,'d9dd6ec1-f1bd-4d69-9d4a-9d0ea4fc5830','20260524_001','2026-05-24 05:52:37','1','admin','4800016082979','Magic Chips BBQ Flav 28g','B-002',90,10,100,4.00,7.00,NULL,'batch_sync',1),(8,'c2c165a8-dd50-4b26-af6a-d671f74fe29a','20260524_002','2026-05-24 06:03:57','1','admin','4800016082979','Magic Chips BBQ Flav 28g','B-003',100,20,120,6.00,11.00,NULL,'batch_sync',1),(9,'ec3fc7ba-b864-4a24-9443-2a49e3470162','20260524_003','2026-05-24 07:34:57','1','admin','4800016082979','Magic Chips BBQ Flav 28g','B-004',120,20,140,5.00,10.00,NULL,'batch_sync',1),(10,'847d88be-b70f-4076-8bc9-c409900d2b85','20260524_004','2026-05-24 18:03:48','1','admin','4800274020010','Quaker Oatmeal 200g','B-001',0,35,35,65.00,105.00,'2027-08-14','batch_sync',1);
/*!40000 ALTER TABLE `product_batches_sync_history` ENABLE KEYS */;
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
