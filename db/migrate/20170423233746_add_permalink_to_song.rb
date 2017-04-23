class AddPermalinkToSong < ActiveRecord::Migration[5.0]
  def change
    add_column :songs, :permalink, :string
  end
end
