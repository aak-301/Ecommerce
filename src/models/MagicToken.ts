import pool from '../config/database';
import { MagicToken } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class MagicTokenModel {
  static async create(email: string): Promise<string> {
    const id = uuidv4();
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + (parseInt(process.env.MAGIC_LINK_EXPIRES_IN!) * 60 * 1000));
    
    // Delete any existing unused tokens for this email
    await pool.query('DELETE FROM magic_tokens WHERE email = $1 AND used = false', [email]);
    
    const query = `
      INSERT INTO magic_tokens (id, email, token, expires_at, used, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING token
    `;
    
    const result = await pool.query(query, [id, email, token, expiresAt, false]);
    return result.rows[0].token;
  }

  static async findByToken(token: string): Promise<MagicToken | null> {
    const query = 'SELECT * FROM magic_tokens WHERE token = $1';
    const result = await pool.query(query, [token]);
    return result.rows[0] || null;
  }

  static async markAsUsed(token: string): Promise<void> {
    const query = 'UPDATE magic_tokens SET used = true WHERE token = $1';
    await pool.query(query, [token]);
  }

  static async isValid(token: string): Promise<boolean> {
    const magicToken = await this.findByToken(token);
    
    if (!magicToken || magicToken.used) {
      return false;
    }
    
    const now = new Date();
    return now < new Date(magicToken.expires_at);
  }
}

