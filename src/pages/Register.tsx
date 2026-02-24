import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [realName, setRealName] = useState('');
  const [dob, setDob] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, real_name: realName, date_of_birth: dob }),
      });
      
      if (res.ok) {
        navigate('/feed');
      } else {
        const data = await res.json();
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('An error occurred');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-[350px] glass border-white/10">
        <CardHeader>
          <CardTitle className="text-2xl font-display font-bold text-white">Register</CardTitle>
          <CardDescription className="text-gray-400">Create a new account to join the community.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister}>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Input 
                  placeholder="Real Name" 
                  value={realName} 
                  onChange={(e) => setRealName(e.target.value)} 
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-accent"
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Input 
                  placeholder="Date of Birth" 
                  type="date"
                  value={dob} 
                  onChange={(e) => setDob(e.target.value)} 
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-accent"
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Input 
                  placeholder="Username" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-accent"
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Input 
                  placeholder="Email" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-accent"
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Input 
                  placeholder="Password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-accent"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
            <Button className="w-full mt-6 bg-accent hover:bg-accent/90 text-white font-semibold" type="submit">Sign Up</Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-400">
            Already have an account? <Link to="/login" className="text-accent hover:underline">Login</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
