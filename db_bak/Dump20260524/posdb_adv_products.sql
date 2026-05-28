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
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `product_id` int(11) NOT NULL AUTO_INCREMENT,
  `product_barcode` varchar(50) DEFAULT NULL,
  `product_name` varchar(100) DEFAULT NULL,
  `category` varchar(50) DEFAULT NULL,
  `brand` varchar(50) DEFAULT NULL,
  `unit` varchar(20) DEFAULT NULL,
  `rop` int(11) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `product_image_path` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`product_id`),
  UNIQUE KEY `product_barcode` (`product_barcode`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (2,'85558','CEMENT','Cement & Concrete Products','MAYON','sack',0,'2025-07-12 11:51:34',NULL),(4,'8755885','10MM STEEL BAR','Steel & Metal Products','N/A','pc',0,'2025-07-12 22:09:16',NULL),(5,'45544','DUCK TAPE 100MM X 200MM','Hardware Accessories','DOCKY','roll',0,'2025-07-12 22:12:08',NULL),(6,'4123','MILO 20GRMS','Cement & Concrete Products','DOCKY','pc',0,'2025-07-22 11:02:35',NULL),(7,'4801981118502','290ml Coca-cola','Drinks','COCA COLA','pc',0,'2025-07-23 06:03:19',NULL),(8,'DSF','124123','Cement & Concrete Products','COCA COLA','roll',50,'2025-07-25 16:21:22',NULL),(9,'8851932301572','MAGIC POWEDER','BABY POWEDER','BB','pc',50,'2025-07-26 09:42:37',NULL),(10,'55556645','GAMING MOUSE 3000DPI','COMPUTER ACCESSORIES','RAZER','pc',25,'2025-07-27 05:10:02',NULL),(11,'SDFWFF','AAAA','Steel & Metal Products','DOCKY','set',20,'2025-07-27 05:10:39',NULL),(13,'4800016661006','Roller Coaster Potato Ringes 24G','JUNK FOODS','JACK N JILL','pc',20,'2026-05-23 19:56:11','/api/product-images/product-13.webp'),(14,'4800016082979','Magic Chips BBQ Flav 28g','JUNK FOODS','JACK N JILL','pc',20,'2026-05-23 19:57:35','/api/product-images/product-14.webp'),(15,'4801668200056','MAFRAN 320G','CATSUP','NUTRIASIA','pc',20,'2026-05-23 20:05:52','/api/product-images/product-15.webp');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-24  7:58:45
