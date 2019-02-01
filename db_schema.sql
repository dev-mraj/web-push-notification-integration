CREATE TABLE `push_subscribers` (
  `id` varchar(64) NOT NULL,
  `subscription` text,
  `name` varchar(255) DEFAULT NULL,
  `timezone_offset` int(11) DEFAULT NULL,
  `ip` varchar(255) DEFAULT NULL,
  `country` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8
