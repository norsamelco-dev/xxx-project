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
-- Table structure for table `receipt_heading`
--

DROP TABLE IF EXISTS `receipt_heading`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `receipt_heading` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `busi_name` varchar(45) DEFAULT 'N/A',
  `busi_addr` varchar(200) DEFAULT 'N/A',
  `busi_owner` varchar(100) DEFAULT 'N/A',
  `busi_vat_type` varchar(45) DEFAULT 'N/A',
  `busi_tin` varchar(45) DEFAULT 'N/A',
  `vat_rate` decimal(5,2) DEFAULT 0.00,
  `IMG` longblob DEFAULT NULL,
  `developer` varchar(200) DEFAULT 'N/A',
  `accreditation_no` varchar(45) DEFAULT 'N/A',
  `valid_start` date DEFAULT NULL,
  `valid_until` date DEFAULT NULL,
  `softwareversion` varchar(45) DEFAULT 'N/A',
  `contactdetail` varchar(100) DEFAULT 'N/A',
  `business_logo_path` varchar(500) DEFAULT NULL,
  `developer_logo_path` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `receipt_heading`
--

LOCK TABLES `receipt_heading` WRITE;
/*!40000 ALTER TABLE `receipt_heading` DISABLE KEYS */;
INSERT INTO `receipt_heading` VALUES (1,'LUCKY SAVER HARDWARE & CONSTRUCTION SUPPLY','Magallanes st. Kinabranan 1, Allen, Northern Samar','Elorde J. Tan - Prop.','VAT REG TIN','155-455-504-00000',0.12,NULL,'XYZ Trading Corp.','BIR-ACC-2024-00123','2024-02-28','2030-07-17','1.1.1.3','0917-XXX-XXXX | dev@abcsoft.ph','/api/logos/business-logo.png','/api/logos/developer-logo.png');
/*!40000 ALTER TABLE `receipt_heading` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-23 12:37:14
